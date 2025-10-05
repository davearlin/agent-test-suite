from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd
import json
import io
import chardet

from app.core.database import get_db
from app.core.config import settings
from app.core.html_utils import analyze_html_in_csv_column
from app.core.csv_utils import escape_csv_value
from app.api.auth import get_current_user
from app.models import User, Dataset, Question
from app.models.schemas import (
    Dataset as DatasetSchema,
    DatasetCreate,
    DatasetUpdate,
    DatasetSummary,
    Question as QuestionSchema,
    QuestionCreate,
    QuestionUpdate,
    DatasetImport,
    CSVPreview
)

router = APIRouter()


def detect_and_decode_content(content: bytes) -> str:
    """Detect encoding and decode content to string."""
    # Try common encodings in order of preference
    encodings_to_try = [
        'utf-8',
        'utf-8-sig',  # UTF-8 with BOM
        'cp1252',     # Windows-1252 (common in Windows CSV files)
        'iso-8859-1', # Latin-1
        'ascii'
    ]
    
    # First try chardet to detect encoding
    try:
        detected = chardet.detect(content)
        if detected['encoding'] and detected['confidence'] > 0.7:
            detected_encoding = detected['encoding'].lower()
            # Normalize encoding names
            if 'windows-1252' in detected_encoding or 'cp1252' in detected_encoding:
                detected_encoding = 'cp1252'
            elif 'utf-8' in detected_encoding:
                detected_encoding = 'utf-8'
            elif 'iso-8859-1' in detected_encoding or 'latin-1' in detected_encoding:
                detected_encoding = 'iso-8859-1'
            
            # Try detected encoding first
            if detected_encoding not in encodings_to_try:
                encodings_to_try.insert(0, detected_encoding)
            else:
                # Move detected encoding to front
                encodings_to_try.remove(detected_encoding)
                encodings_to_try.insert(0, detected_encoding)
    except Exception:
        pass  # If chardet fails, continue with fallback encodings
    
    # Try each encoding
    for encoding in encodings_to_try:
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    
    # If all else fails, decode with errors='replace' to avoid crashing
    return content.decode('utf-8', errors='replace')


@router.get("/", response_model=List[DatasetSummary])
async def list_datasets(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all datasets with optional filtering."""
    query = db.query(Dataset)
    
    if category:
        query = query.filter(Dataset.category == category)
    
    # Non-admin users can only see their own datasets
    if current_user.role != "admin":
        query = query.filter(Dataset.owner_id == current_user.id)
    
    datasets = query.offset(skip).limit(limit).all()
    
    # Convert to summary format
    summaries = []
    for dataset in datasets:
        summaries.append(DatasetSummary(
            id=dataset.id,
            name=dataset.name,
            category=dataset.category,
            version=dataset.version,
            question_count=len(dataset.questions),
            created_at=dataset.created_at,
            owner_name=dataset.owner.full_name
        ))
    
    return summaries


@router.post("/", response_model=DatasetSchema)
async def create_dataset(
    dataset_data: DatasetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new dataset."""
    if current_user.role not in ["admin", "test_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    db_dataset = Dataset(
        name=dataset_data.name,
        description=dataset_data.description,
        category=dataset_data.category,
        version=dataset_data.version,
        owner_id=current_user.id
    )
    
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    
    # Add questions if provided
    for question_data in dataset_data.questions:
        db_question = Question(
            dataset_id=db_dataset.id,
            question_text=question_data.question_text,
            expected_answer=question_data.expected_answer,
            detect_empathy=question_data.detect_empathy,
            no_match=question_data.no_match,
            priority=question_data.priority,
            tags=question_data.tags,
            metadata=question_data.metadata
        )
        db.add(db_question)
    
    db.commit()
    db.refresh(db_dataset)
    
    return db_dataset


@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific dataset by ID."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Use raw SQL to avoid SQLAlchemy metadata conflicts
    questions_query = text("""
        SELECT id, dataset_id, question_text, expected_answer, detect_empathy, 
               no_match, priority, tags, question_metadata, created_at
        FROM questions 
        WHERE dataset_id = :dataset_id
    """)
    result = db.execute(questions_query, {"dataset_id": dataset_id})
    
    questions = []
    for row in result:
        # Access row elements by index to avoid SQLAlchemy metadata issues
        question_dict = {
            "id": row[0],
            "dataset_id": row[1], 
            "question_text": row[2],
            "expected_answer": row[3],
            "detect_empathy": row[4],
            "no_match": row[5],
            "priority": row[6],
            "tags": row[7] or [],
            "metadata": row[8] or {},
            "created_at": row[9].isoformat() if row[9] else None
        }
        questions.append(question_dict)
    
    response_data = {
        "id": dataset.id,
        "name": dataset.name,
        "description": dataset.description or "",
        "category": dataset.category,
        "version": dataset.version,
        "owner_id": dataset.owner_id,
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
        "updated_at": dataset.updated_at.isoformat() if dataset.updated_at else None,
        "questions": questions
    }
    
    return response_data


@router.put("/{dataset_id}", response_model=DatasetSchema)
async def update_dataset(
    dataset_id: int,
    dataset_update: DatasetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Update fields
    update_data = dataset_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)
    
    db.commit()
    db.refresh(dataset)
    
    return dataset


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    db.delete(dataset)
    db.commit()
    
    return {"message": "Dataset deleted successfully"}


@router.post("/{dataset_id}/questions", response_model=QuestionSchema)
async def add_question(
    dataset_id: int,
    question_data: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a question to a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    db_question = Question(
        dataset_id=dataset_id,
        question_text=question_data.question_text,
        expected_answer=question_data.expected_answer,
        detect_empathy=question_data.detect_empathy,
        no_match=question_data.no_match,
        priority=question_data.priority,
        tags=question_data.tags,
        metadata=question_data.metadata
    )
    
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    
    return db_question


@router.put("/questions/{question_id}", response_model=QuestionSchema)
async def update_question(
    question_id: int,
    question_update: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a question."""
    question = db.query(Question).filter(Question.id == question_id).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Check permissions via dataset ownership
    dataset = question.dataset
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Update fields
    update_data = question_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)
    
    db.commit()
    db.refresh(question)
    
    return question


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question."""
    question = db.query(Question).filter(Question.id == question_id).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Check permissions via dataset ownership
    dataset = question.dataset
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    db.delete(question)
    db.commit()
    
    return {"message": "Question deleted successfully"}


@router.post("/{dataset_id}/preview-csv", response_model=CSVPreview)
async def preview_csv(
    dataset_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview CSV file to allow column mapping."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Check file size
        content = await file.read()
        file_size = len(content)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size / 1024 / 1024:.1f}MB) exceeds maximum allowed size ({settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB)"
            )
        
        if not file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are supported for preview."
            )
        
        # Parse CSV with proper encoding detection
        decoded_content = detect_and_decode_content(content)
        df = pd.read_csv(io.StringIO(decoded_content))
        
        # Get headers
        headers = df.columns.tolist()
        
        # Get first 5 rows as sample data
        sample_rows = []
        for _, row in df.head(5).iterrows():
            sample_rows.append({col: str(val) for col, val in row.items()})
        
        # Analyze HTML content in each column
        html_analysis = {}
        for column in headers:
            column_data = df[column].dropna().astype(str).tolist()
            if column_data:  # Only analyze if column has data
                # Use larger sample size for better analysis of large datasets
                sample_size = min(1000, len(column_data))  # Up to 1000 rows for analysis
                analysis = analyze_html_in_csv_column(column_data, sample_size=sample_size)
                if analysis["has_html"]:  # Only include columns that have HTML
                    html_analysis[column] = analysis
        
        return CSVPreview(
            headers=headers,
            sample_rows=sample_rows,
            total_rows=len(df),
            html_analysis=html_analysis if html_analysis else None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV file: {str(e)}"
        )


@router.post("/{dataset_id}/import")
async def import_dataset(
    dataset_id: int,
    file: UploadFile = File(...),
    question_column: str = Form("question"),
    answer_column: str = Form("answer"), 
    empathy_column: Optional[str] = Form(None),
    no_match_column: Optional[str] = Form(None),
    priority_column: Optional[str] = Form(None),
    tags_column: Optional[str] = Form(None),
    metadata_columns: Optional[str] = Form(None),  # Comma-separated list
    strip_html_from_question: bool = Form(False),  # Whether to strip HTML from question column
    strip_html_from_answer: bool = Form(False),   # Whether to strip HTML from answer column
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import questions from a file (CSV, JSON, or Excel)."""
    print(f"Import request parameters:")
    print(f"  question_column: '{question_column}'")
    print(f"  answer_column: '{answer_column}'") 
    print(f"  empathy_column: '{empathy_column}'")
    print(f"  no_match_column: '{no_match_column}'")
    print(f"  priority_column: '{priority_column}'")
    print(f"  tags_column: '{tags_column}'")
    print(f"  metadata_columns: '{metadata_columns}'")
    print(f"  strip_html_from_question: {strip_html_from_question}")
    print(f"  strip_html_from_answer: {strip_html_from_answer}")
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        content = await file.read()
        file_size = len(content)
        
        # Check file size
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size / 1024 / 1024:.1f}MB) exceeds maximum allowed size ({settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB)"
            )
        
        # Parse file based on type
        if file.filename.endswith('.csv'):
            decoded_content = detect_and_decode_content(content)
            df = pd.read_csv(io.StringIO(decoded_content))
        elif file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.json'):
            decoded_content = detect_and_decode_content(content)
            data = json.loads(decoded_content)
            df = pd.DataFrame(data)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Use CSV, Excel, or JSON."
            )
        
        # Parse metadata columns
        metadata_column_list = []
        if metadata_columns:
            metadata_column_list = [col.strip() for col in metadata_columns.split(",") if col.strip()]
        
        # Process the data
        questions_added = 0
        total_rows = len(df)
        batch_size = 100  # Process in batches for better performance
        
        print(f"Starting import of {total_rows} rows from {file.filename}")
        print(f"Column mapping: question='{question_column}', answer='{answer_column}'")
        print(f"Available columns: {list(df.columns)}")
        
        for i, (_, row) in enumerate(df.iterrows()):
            question_text = str(row.get(question_column, ""))
            expected_answer = str(row.get(answer_column, ""))
            
            # Apply HTML stripping if requested
            if strip_html_from_question and question_text:
                from app.core.html_utils import strip_html_tags
                question_text = strip_html_tags(question_text)
            
            if strip_html_from_answer and expected_answer:
                from app.core.html_utils import strip_html_tags
                expected_answer = strip_html_tags(expected_answer)
            
            # Debug first few rows
            if i < 3:
                print(f"Row {i}: question='{question_text}', answer='{expected_answer}'")
            
            if not question_text or not expected_answer:
                if i < 10:  # Only log first 10 skipped rows to avoid spam
                    print(f"Skipping row {i}: empty question or answer")
                continue
            
            # Parse optional fields
            detect_empathy = False
            if empathy_column and empathy_column in row:
                detect_empathy = bool(row[empathy_column])
            
            no_match = False
            if no_match_column and no_match_column in row:
                no_match = bool(row[no_match_column])
            
            priority = "medium"
            if priority_column and priority_column in row:
                priority = str(row[priority_column]).lower()
                if priority not in ["high", "medium", "low"]:
                    priority = "medium"
            
            tags = []
            if tags_column and tags_column in row:
                tags_str = str(row[tags_column])
                tags = [tag.strip() for tag in tags_str.split(",") if tag.strip()]
            
            # Collect metadata from unmapped columns
            metadata = {}
            mapped_columns = {
                question_column,
                answer_column,
                empathy_column,
                no_match_column,
                priority_column,
                tags_column
            }
            mapped_columns = {col for col in mapped_columns if col is not None}
            
            # If metadata_columns is specified, only include those columns
            # Otherwise, include all unmapped columns
            if metadata_column_list:
                for col in metadata_column_list:
                    if col in row:
                        metadata[col] = str(row[col])
            else:
                for col in df.columns:
                    if col not in mapped_columns and col in row:
                        metadata[col] = str(row[col])
            
            # Create question
            db_question = Question(
                dataset_id=dataset_id,
                question_text=question_text,
                expected_answer=expected_answer,
                detect_empathy=detect_empathy,
                no_match=no_match,
                priority=priority,
                tags=tags,
                question_metadata=metadata if metadata else None
            )
            
            db.add(db_question)
            questions_added += 1
            
            # Commit in batches and log progress for large imports
            if questions_added % batch_size == 0:
                db.commit()
                progress_pct = (i + 1) / total_rows * 100
                print(f"Import progress: {questions_added} questions added ({progress_pct:.1f}% complete)")
        
        # Final commit
        db.commit()
        
        print(f"Import completed: {questions_added} questions added from {file.filename}")
        
        return {
            "message": f"Successfully imported {questions_added} questions",
            "questions_added": questions_added
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/{dataset_id}/export")
async def export_dataset_csv(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export dataset questions to CSV format."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Check permissions - allow viewing if user has access
    if current_user.role not in ["admin", "test_manager"] and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get questions with the dataset
        questions = db.query(Question).filter(Question.dataset_id == dataset_id).all()
        
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No questions found in this dataset"
            )
        

        
        # CSV headers
        headers = [
            'question', 'answer', 'detect_empathy', 'no_match', 'priority', 'tags'
        ]
        
        # Collect all unique metadata keys
        metadata_keys = set()
        for question in questions:
            if question.question_metadata:
                metadata_keys.update(question.question_metadata.keys())
        
        # Sort metadata keys for consistent column order
        metadata_keys = sorted(list(metadata_keys))
        headers.extend(metadata_keys)
        
        # Build CSV content
        csv_rows = [','.join(headers)]
        
        for question in questions:
            # Basic fields
            tags_str = ','.join(question.tags) if question.tags else ''
            
            row = [
                escape_csv_value(question.question_text),
                escape_csv_value(question.expected_answer),
                str(question.detect_empathy).lower(),
                str(question.no_match).lower(),
                question.priority.value if question.priority else 'medium',
                escape_csv_value(tags_str)
            ]
            
            # Add metadata fields
            for key in metadata_keys:
                if question.question_metadata and key in question.question_metadata:
                    row.append(escape_csv_value(question.question_metadata[key]))
                else:
                    row.append('')
            
            csv_rows.append(','.join(row))
        
        csv_content = '\n'.join(csv_rows)
        
        # Create filename
        safe_name = dataset.name.replace(' ', '_').replace('/', '_').replace('\\', '_')
        filename = f"dataset_{dataset_id}_{safe_name}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting dataset: {str(e)}"
        )
