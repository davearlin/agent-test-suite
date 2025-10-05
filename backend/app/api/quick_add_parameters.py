"""
Quick Add Parameters API endpoints.
Manages configurable quick-add parameter options for session parameters.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.core.database import get_db
from app.core.csv_utils import escape_csv_value
from app.api.auth import get_current_user
from app.models import QuickAddParameter, User
from app.models.schemas import (
    QuickAddParameter as QuickAddParameterSchema,
    QuickAddParameterCreate,
    QuickAddParameterUpdate
)

router = APIRouter(prefix="/quick-add-parameters", tags=["quick-add-parameters"])


@router.get("/", response_model=List[QuickAddParameterSchema])
async def get_quick_add_parameters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active quick add parameters, ordered by sort_order."""
    parameters = db.query(QuickAddParameter).filter(
        QuickAddParameter.is_active == True
    ).order_by(QuickAddParameter.sort_order, QuickAddParameter.name).all()
    
    return parameters


@router.post("/", response_model=QuickAddParameterSchema)
async def create_quick_add_parameter(
    parameter: QuickAddParameterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new quick add parameter."""
    # Check if key-value combination already exists
    existing = db.query(QuickAddParameter).filter(
        QuickAddParameter.key == parameter.key,
        QuickAddParameter.value == parameter.value,
        QuickAddParameter.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parameter with key '{parameter.key}' and value '{parameter.value}' already exists"
        )
    
    db_parameter = QuickAddParameter(
        name=parameter.name,
        key=parameter.key,
        value=parameter.value,
        description=parameter.description,
        is_active=parameter.is_active,
        sort_order=parameter.sort_order,
        created_by_id=current_user.id
    )
    
    db.add(db_parameter)
    db.commit()
    db.refresh(db_parameter)
    
    return db_parameter


@router.get("/export")
async def export_session_parameters_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export all session parameters to CSV format."""
    try:
        # Get all active session parameters
        parameters = db.query(QuickAddParameter).filter(
            QuickAddParameter.is_active == True
        ).order_by(QuickAddParameter.sort_order, QuickAddParameter.name).all()
        
        if not parameters:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No session parameters found"
            )
        
        # CSV headers
        headers = ['name', 'key', 'value', 'description', 'is_active', 'sort_order']
        
        # Build CSV content
        csv_rows = [','.join(headers)]
        
        for param in parameters:
            row = [
                escape_csv_value(param.name),
                escape_csv_value(param.key),
                escape_csv_value(param.value),
                escape_csv_value(param.description),
                str(param.is_active).lower(),
                str(param.sort_order)
            ]
            csv_rows.append(','.join(row))
        
        csv_content = '\n'.join(csv_rows)
        
        # Create filename with timestamp
        filename = "session_parameters.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting session parameters: {str(e)}"
        )


@router.post("/import")
async def import_session_parameters_csv(
    file: UploadFile = File(...),
    replace_existing: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import session parameters from CSV file."""
    try:
        # Validate file type
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are supported"
            )
        
        # Read and parse CSV content
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        
        # Validate required columns
        required_columns = ['name', 'key', 'value']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # If replace_existing is True, deactivate all existing parameters
        if replace_existing:
            existing_params = db.query(QuickAddParameter).filter(
                QuickAddParameter.is_active == True
            ).all()
            for param in existing_params:
                param.is_active = False
        
        parameters_added = 0
        parameters_updated = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Extract required fields
                name = str(row['name']).strip()
                key = str(row['key']).strip()
                value = str(row['value']).strip()
                
                if not all([name, key, value]):
                    errors.append(f"Row {index + 2}: Missing required fields (name, key, value)")
                    continue
                
                # Extract optional fields
                description = str(row.get('description', '')).strip() if pd.notna(row.get('description')) else None
                is_active = str(row.get('is_active', 'true')).lower() in ['true', '1', 'yes']
                sort_order = int(row.get('sort_order', 0)) if pd.notna(row.get('sort_order')) else 0
                
                # Check if parameter already exists by key-value combination
                existing = db.query(QuickAddParameter).filter(
                    QuickAddParameter.key == key,
                    QuickAddParameter.value == value
                ).first()
                
                if existing:
                    # Update existing parameter
                    existing.name = name
                    existing.description = description
                    existing.is_active = is_active
                    existing.sort_order = sort_order
                    parameters_updated += 1
                else:
                    # Create new parameter
                    new_param = QuickAddParameter(
                        name=name,
                        key=key,
                        value=value,
                        description=description,
                        is_active=is_active,
                        sort_order=sort_order,
                        created_by_id=current_user.id
                    )
                    db.add(new_param)
                    parameters_added += 1
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                continue
        
        db.commit()
        
        result = {
            "message": f"Import completed: {parameters_added} added, {parameters_updated} updated",
            "parameters_added": parameters_added,
            "parameters_updated": parameters_updated
        }
        
        if errors:
            result["errors"] = errors
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV file: {str(e)}"
        )


@router.get("/{parameter_id}", response_model=QuickAddParameterSchema)
async def get_quick_add_parameter(
    parameter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific quick add parameter by ID."""
    parameter = db.query(QuickAddParameter).filter(
        QuickAddParameter.id == parameter_id
    ).first()
    
    if not parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quick add parameter not found"
        )
    
    return parameter


@router.put("/{parameter_id}", response_model=QuickAddParameterSchema)
async def update_quick_add_parameter(
    parameter_id: int,
    parameter_update: QuickAddParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a quick add parameter."""
    db_parameter = db.query(QuickAddParameter).filter(
        QuickAddParameter.id == parameter_id
    ).first()
    
    if not db_parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quick add parameter not found"
        )
    
    # Check for duplicate key-value combination if key or value is being updated
    if parameter_update.key or parameter_update.value:
        new_key = parameter_update.key if parameter_update.key is not None else db_parameter.key
        new_value = parameter_update.value if parameter_update.value is not None else db_parameter.value
        
        existing = db.query(QuickAddParameter).filter(
            QuickAddParameter.key == new_key,
            QuickAddParameter.value == new_value,
            QuickAddParameter.is_active == True,
            QuickAddParameter.id != parameter_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter with key '{new_key}' and value '{new_value}' already exists"
            )
    
    # Update fields
    update_data = parameter_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_parameter, field, value)
    
    db.commit()
    db.refresh(db_parameter)
    
    return db_parameter


@router.delete("/{parameter_id}")
async def delete_quick_add_parameter(
    parameter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete (soft delete by setting is_active=False) a quick add parameter."""
    db_parameter = db.query(QuickAddParameter).filter(
        QuickAddParameter.id == parameter_id
    ).first()
    
    if not db_parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quick add parameter not found"
        )
    
    # Soft delete by setting is_active to False
    db_parameter.is_active = False
    db.commit()
    
    return {"message": "Quick add parameter deleted successfully"}


@router.post("/reorder")
async def reorder_quick_add_parameters(
    parameter_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reorder quick add parameters by updating their sort_order."""
    parameters = db.query(QuickAddParameter).filter(
        QuickAddParameter.id.in_(parameter_ids)
    ).all()
    
    if len(parameters) != len(parameter_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more parameter IDs not found"
        )
    
    # Update sort order based on the order in the list
    for index, parameter_id in enumerate(parameter_ids):
        parameter = next(p for p in parameters if p.id == parameter_id)
        parameter.sort_order = index
    
    db.commit()
    
    return {"message": "Parameters reordered successfully"}