from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
import pandas as pd
import io

from app.core.database import get_db
from app.core.csv_utils import escape_csv_value
from app.api.auth import get_current_user
from app.models import (
    User, EvaluationParameter, TestRunEvaluationConfig, EvaluationPreset
)
from app.models.schemas import (
    EvaluationParameter as EvaluationParameterSchema,
    EvaluationParameterCreate,
    EvaluationParameterUpdate,
    EvaluationPreset as EvaluationPresetSchema,
    EvaluationPresetCreate,
    EvaluationPresetUpdate,
    TestRunEvaluationConfig as TestRunEvaluationConfigSchema,
    TestRunEvaluationConfigCreate,
    TestRunEvaluationConfigUpdate,
    UserEvaluationPreferences
)

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/parameters", response_model=List[EvaluationParameterSchema])
async def get_evaluation_parameters(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available evaluation parameters."""
    query = db.query(EvaluationParameter)
    
    if not include_inactive:
        query = query.filter(EvaluationParameter.is_active == True)
    
    # System defaults + user-created parameters
    query = query.filter(
        (EvaluationParameter.is_system_default == True) |
        (EvaluationParameter.created_by_id == current_user.id)
    )
    
    return query.order_by(EvaluationParameter.name).all()


@router.get("/parameters/export")
async def export_evaluation_parameters_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export evaluation parameters to CSV format."""
    try:
        query = db.query(EvaluationParameter).filter(
            EvaluationParameter.is_active == True,
            (
                (EvaluationParameter.is_system_default == True) |
                (EvaluationParameter.created_by_id == current_user.id)
            )
        ).order_by(EvaluationParameter.name)

        parameters = query.all()

        if not parameters:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No evaluation parameters found"
            )

        headers = ['name', 'description', 'prompt_template', 'is_system_default', 'is_active']
        csv_rows = [','.join(headers)]

        for param in parameters:
            row = [
                escape_csv_value(param.name),
                escape_csv_value(param.description),
                escape_csv_value(param.prompt_template),
                str(param.is_system_default).lower(),
                str(param.is_active).lower()
            ]
            csv_rows.append(','.join(row))

        csv_content = '\n'.join(csv_rows)
        filename = "evaluation_parameters.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting evaluation parameters: {str(e)}"
        )


@router.post("/parameters/import")
async def import_evaluation_parameters_csv(
    file: UploadFile = File(...),
    replace_existing: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import evaluation parameters from CSV file."""
    try:
        if current_user.role not in ["admin", "test_manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators and test managers can import evaluation parameters"
            )

        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are supported"
            )

        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))

        required_columns = ['name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )

        parameters_added = 0
        parameters_updated = 0
        errors = []

        for index, row in df.iterrows():
            try:
                name = str(row['name']).strip()

                if not name:
                    errors.append(f"Row {index + 2}: Missing required name")
                    continue

                description = str(row.get('description', '')).strip() if pd.notna(row.get('description')) else None
                prompt_template = str(row.get('prompt_template', '')).strip() if pd.notna(row.get('prompt_template')) else None
                is_system_default = str(row.get('is_system_default', 'false')).lower() in ['true', '1', 'yes']
                is_active = str(row.get('is_active', 'true')).lower() in ['true', '1', 'yes']

                if is_system_default and current_user.role != "admin":
                    is_system_default = False

                existing = db.query(EvaluationParameter).filter(
                    EvaluationParameter.name == name
                ).first()

                if existing:
                    if (not existing.is_system_default or current_user.role == "admin") and not replace_existing:
                        existing.description = description
                        existing.prompt_template = prompt_template
                        existing.is_active = is_active
                        if current_user.role == "admin":
                            existing.is_system_default = is_system_default
                        parameters_updated += 1
                    elif replace_existing and (existing.created_by_id == current_user.id or current_user.role == "admin"):
                        existing.description = description
                        existing.prompt_template = prompt_template
                        existing.is_active = is_active
                        if current_user.role == "admin":
                            existing.is_system_default = is_system_default
                        parameters_updated += 1
                else:
                    new_param = EvaluationParameter(
                        name=name,
                        description=description,
                        prompt_template=prompt_template,
                        is_system_default=is_system_default,
                        is_active=is_active,
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



@router.get("/parameters/{parameter_id}", response_model=EvaluationParameterSchema)
async def get_evaluation_parameter(
    parameter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific evaluation parameter by ID."""
    db_parameter = db.query(EvaluationParameter).filter(
        EvaluationParameter.id == parameter_id
    ).first()
    
    if not db_parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation parameter not found"
        )
    
    # Check if user has access to this parameter
    if not db_parameter.is_system_default and db_parameter.created_by_id != current_user.id:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this parameter"
            )
    
    return db_parameter


@router.post("/parameters", response_model=EvaluationParameterSchema)
async def create_evaluation_parameter(
    parameter: EvaluationParameterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new custom evaluation parameter."""
    if current_user.role not in ["admin", "test_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and test managers can create evaluation parameters"
        )
    
    if not parameter.prompt_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom parameters must have a prompt template"
        )
    
    db_parameter = EvaluationParameter(
        **parameter.dict(),
        created_by_id=current_user.id,
        is_system_default=False
    )
    db.add(db_parameter)
    db.commit()
    db.refresh(db_parameter)
    
    return db_parameter


@router.put("/parameters/{parameter_id}", response_model=EvaluationParameterSchema)
async def update_evaluation_parameter(
    parameter_id: int,
    parameter_update: EvaluationParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an evaluation parameter."""
    db_parameter = db.query(EvaluationParameter).filter(
        EvaluationParameter.id == parameter_id
    ).first()
    
    if not db_parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation parameter not found"
        )
    
    # Only allow updates to user-created parameters or by admins
    if db_parameter.is_system_default and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system default parameters"
        )
    
    if db_parameter.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only modify your own parameters"
        )
    
    # Update fields
    for field, value in parameter_update.dict(exclude_unset=True).items():
        setattr(db_parameter, field, value)
    
    db.commit()
    db.refresh(db_parameter)
    
    return db_parameter


@router.delete("/parameters/{parameter_id}")
async def delete_evaluation_parameter(
    parameter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom evaluation parameter."""
    db_parameter = db.query(EvaluationParameter).filter(
        EvaluationParameter.id == parameter_id
    ).first()
    
    if not db_parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation parameter not found"
        )
    
    # Cannot delete system defaults
    if db_parameter.is_system_default:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system default parameters"
        )
    
    # Only allow deletion by creator or admin
    if db_parameter.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own parameters"
        )
    
    db.delete(db_parameter)
    db.commit()
    
    return {"message": "Evaluation parameter deleted successfully"}


@router.get("/configs", response_model=List[TestRunEvaluationConfigSchema])
async def get_evaluation_configs(
    include_test_run_configs: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's saved evaluation configurations."""
    query = db.query(TestRunEvaluationConfig).filter(
        TestRunEvaluationConfig.user_id == current_user.id
    )
    
    if not include_test_run_configs:
        # Only return user preference configs (not tied to specific test runs)
        query = query.filter(TestRunEvaluationConfig.test_run_id.is_(None))
    
    return query.order_by(TestRunEvaluationConfig.created_at.desc()).all()


@router.post("/configs", response_model=TestRunEvaluationConfigSchema)
async def create_evaluation_config(
    config: TestRunEvaluationConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new evaluation configuration."""
    # Validate that all referenced parameters exist and are accessible
    parameter_ids = [p.parameter_id for p in config.parameters]
    accessible_params = db.query(EvaluationParameter).filter(
        EvaluationParameter.id.in_(parameter_ids),
        EvaluationParameter.is_active == True,
        (
            (EvaluationParameter.is_system_default == True) |
            (EvaluationParameter.created_by_id == current_user.id)
        )
    ).all()
    
    if len(accessible_params) != len(parameter_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more evaluation parameters are not accessible"
        )
    
    # If setting as default, clear other defaults
    if config.is_default:
        db.query(TestRunEvaluationConfig).filter(
            TestRunEvaluationConfig.user_id == current_user.id,
            TestRunEvaluationConfig.test_run_id.is_(None),
            TestRunEvaluationConfig.is_default == True
        ).update({"is_default": False})
    
    db_config = TestRunEvaluationConfig(
        **config.dict(),
        user_id=current_user.id
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.put("/configs/{config_id}", response_model=TestRunEvaluationConfigSchema)
async def update_evaluation_config(
    config_id: int,
    config_update: TestRunEvaluationConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an evaluation configuration."""
    db_config = db.query(TestRunEvaluationConfig).filter(
        TestRunEvaluationConfig.id == config_id,
        TestRunEvaluationConfig.user_id == current_user.id
    ).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation configuration not found"
        )
    
    # Cannot modify test run-specific configs
    if db_config.test_run_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify test run-specific configurations"
        )
    
    # If setting as default, clear other defaults
    if config_update.is_default:
        db.query(TestRunEvaluationConfig).filter(
            TestRunEvaluationConfig.user_id == current_user.id,
            TestRunEvaluationConfig.test_run_id.is_(None),
            TestRunEvaluationConfig.is_default == True,
            TestRunEvaluationConfig.id != config_id
        ).update({"is_default": False})
    
    # Update fields
    for field, value in config_update.dict(exclude_unset=True).items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.delete("/configs/{config_id}")
async def delete_evaluation_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an evaluation configuration."""
    db_config = db.query(TestRunEvaluationConfig).filter(
        TestRunEvaluationConfig.id == config_id,
        TestRunEvaluationConfig.user_id == current_user.id
    ).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation configuration not found"
        )
    
    # Cannot delete test run-specific configs
    if db_config.test_run_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete test run-specific configurations"
        )
    
    db.delete(db_config)
    db.commit()
    
    return {"message": "Evaluation configuration deleted successfully"}


@router.get("/preferences", response_model=UserEvaluationPreferences)
async def get_user_evaluation_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's evaluation preferences."""
    configs = db.query(TestRunEvaluationConfig).filter(
        TestRunEvaluationConfig.user_id == current_user.id,
        TestRunEvaluationConfig.test_run_id.is_(None)
    ).order_by(TestRunEvaluationConfig.created_at.desc()).all()
    
    default_config = next((c for c in configs if c.is_default), None)
    
    return UserEvaluationPreferences(
        default_config_id=default_config.id if default_config else None,
        saved_configs=configs
    )


@router.get("/defaults", response_model=TestRunEvaluationConfigSchema)
async def get_default_evaluation_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the default evaluation configuration for the current user."""
    # First check for user's default config
    user_default = db.query(TestRunEvaluationConfig).filter(
        TestRunEvaluationConfig.user_id == current_user.id,
        TestRunEvaluationConfig.test_run_id.is_(None),
        TestRunEvaluationConfig.is_default == True
    ).first()
    
    if user_default:
        return user_default
    
    # If no user default, create a system default configuration
    system_params = db.query(EvaluationParameter).filter(
        EvaluationParameter.is_system_default == True,
        EvaluationParameter.is_active == True
    ).all()
    
    if not system_params:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No system default evaluation parameters found"
        )
    
    # Create default weights based on parameter names
    default_weights = {
        "Similarity Score": 60,
        "Empathy Level": 30,
        "No-Match Detection": 10
    }
    
    default_config_data = []
    remaining_weight = 100
    
    for param in system_params:
        weight = default_weights.get(param.name, 0)
        if weight == 0 and remaining_weight > 0:
            # Distribute remaining weight evenly among unassigned parameters
            weight = remaining_weight // (len(system_params) - len(default_config_data))
        
        default_config_data.append({
            "parameter_id": param.id,
            "weight": weight,
            "enabled": True
        })
        remaining_weight -= weight
    
    # Create temporary config object (not saved to DB)
    from app.models.schemas import EvaluationParameterConfig
    temp_config = TestRunEvaluationConfigSchema(
        id=0,  # Temporary ID
        test_run_id=None,
        user_id=current_user.id,
        name="System Default",
        is_default=False,
        parameters=[EvaluationParameterConfig(**config) for config in default_config_data],
        created_at=datetime.now(),
        updated_at=None
    )
    
    return temp_config


# ===== EVALUATION PRESET ENDPOINTS =====

@router.get("/presets", response_model=List[EvaluationPresetSchema])
async def get_evaluation_presets(
    include_system: bool = True,
    include_public: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get available evaluation presets."""
    query = db.query(EvaluationPreset)
    
    conditions = []
    
    if include_system:
        conditions.append(EvaluationPreset.is_system_default == True)
    
    if include_public:
        conditions.append(EvaluationPreset.is_public == True)
    
    # Always include user's own presets
    conditions.append(EvaluationPreset.created_by_id == current_user.id)
    
    # Combine conditions with OR
    if conditions:
        query = query.filter(or_(*conditions))
    
    return query.order_by(EvaluationPreset.name).all()


@router.post("/presets", response_model=EvaluationPresetSchema)
async def create_evaluation_preset(
    preset: EvaluationPresetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new evaluation preset."""
    # Validate that all referenced parameters exist and are accessible
    parameter_ids = [p.parameter_id for p in preset.parameters]
    accessible_params = db.query(EvaluationParameter).filter(
        EvaluationParameter.id.in_(parameter_ids),
        EvaluationParameter.is_active == True,
        (
            (EvaluationParameter.is_system_default == True) |
            (EvaluationParameter.created_by_id == current_user.id)
        )
    ).all()
    
    if len(accessible_params) != len(parameter_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more evaluation parameters are not accessible"
        )
    
    db_preset = EvaluationPreset(
        **preset.dict(),
        created_by_id=current_user.id,
        is_system_default=False
    )
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    
    return db_preset


@router.put("/presets/{preset_id}", response_model=EvaluationPresetSchema)
async def update_evaluation_preset(
    preset_id: int,
    preset_update: EvaluationPresetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an evaluation preset."""
    db_preset = db.query(EvaluationPreset).filter(
        EvaluationPreset.id == preset_id
    ).first()
    
    if not db_preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation preset not found"
        )
    
    # Only allow updates to user-created presets or by admins
    if db_preset.is_system_default and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system default presets"
        )
    
    if db_preset.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only modify your own presets"
        )
    
    # If updating parameters, validate them
    if preset_update.parameters is not None:
        parameter_ids = [p.parameter_id for p in preset_update.parameters]
        accessible_params = db.query(EvaluationParameter).filter(
            EvaluationParameter.id.in_(parameter_ids),
            EvaluationParameter.is_active == True,
            (
                (EvaluationParameter.is_system_default == True) |
                (EvaluationParameter.created_by_id == current_user.id)
            )
        ).all()
        
        if len(accessible_params) != len(parameter_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more evaluation parameters are not accessible"
            )
    
    # Update fields
    for field, value in preset_update.dict(exclude_unset=True).items():
        setattr(db_preset, field, value)
    
    db.commit()
    db.refresh(db_preset)
    
    return db_preset


@router.delete("/presets/{preset_id}")
async def delete_evaluation_preset(
    preset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an evaluation preset."""
    db_preset = db.query(EvaluationPreset).filter(
        EvaluationPreset.id == preset_id
    ).first()
    
    if not db_preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation preset not found"
        )
    
    # Cannot delete system defaults
    if db_preset.is_system_default:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system default presets"
        )
    
    # Only allow deletion by creator or admin
    if db_preset.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own presets"
        )
    
    db.delete(db_preset)
    db.commit()
    
    return {"message": "Evaluation preset deleted successfully"}


@router.get("/presets/{preset_id}", response_model=EvaluationPresetSchema)
async def get_evaluation_preset(
    preset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific evaluation preset."""
    db_preset = db.query(EvaluationPreset).filter(
        EvaluationPreset.id == preset_id
    ).first()
    
    if not db_preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation preset not found"
        )
    
    # Check if user has access to this preset
    if not (
        db_preset.is_system_default or 
        db_preset.is_public or 
        db_preset.created_by_id == current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this preset"
        )
    
    return db_preset


@router.get("/available-models")
async def get_available_models(
    force_refresh: bool = False,
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available LLM models for evaluation.
    Uses cached models for fast response times.
    
    Args:
        force_refresh: If True, bypass cache and force a refresh from Google API
    """
    from app.services.model_cache_service import model_cache_service
    
    try:
        models = await model_cache_service.get_available_models(force_refresh=force_refresh)
        
        return {
            "models": models,
            "total_count": len(models),
            "categories": {
                "stable": [m for m in models if m["category"] == "stable"],
                "latest": [m for m in models if m["category"] == "latest"],
                "efficient": [m for m in models if m["category"] == "efficient"],
                "fast": [m for m in models if m["category"] == "fast"],
                "experimental": [m for m in models if m["category"] == "experimental"]
            },
            "cache_info": {
                "last_refresh": model_cache_service.last_refresh.isoformat() if model_cache_service.last_refresh else None,
                "is_cached": model_cache_service._is_cache_valid()
            }
        }
        
    except Exception as e:
        # Return fallback models on any error
        return {
            "models": [
                {"id": "models/gemini-2.0-flash", "name": "Gemini 2.0 Flash (Default)", "category": "stable"},
                {"id": "models/gemini-1.5-flash", "name": "Gemini 1.5 Flash", "category": "stable"},
                {"id": "models/gemini-1.5-pro", "name": "Gemini 1.5 Pro", "category": "stable"}
            ],
            "error": f"Failed to fetch models: {str(e)}"
        }


@router.post("/validate-model")
async def validate_model(
    model_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Validate that a specific model is available and accessible before starting a test run.
    This prevents users from selecting broken models and getting errors during evaluation.
    """
    from app.services.model_cache_service import model_cache_service
    
    model_id = model_data.get("model_id")
    if not model_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_id is required"
        )
    
    try:
        validation_result = await model_cache_service.validate_model(model_id)
        
        if not validation_result["valid"]:
            return {
                "valid": False,
                "error": validation_result["error"],
                "suggestion": validation_result["suggestion"]
            }
        
        return {
            "valid": True,
            "model": validation_result["model"],
            "message": f"Model {model_id} is accessible and ready to use"
        }
        
    except Exception as e:
        return {
            "valid": False,
            "error": f"Validation failed: {str(e)}",
            "suggestion": "Please try again or select a different model"
        }


@router.post("/refresh-model-cache")
async def refresh_model_cache(
    current_user: User = Depends(get_current_user)
):
    """
    Manually refresh the model cache. Useful for administrators
    when new models are released or API access changes.
    """
    from app.services.model_cache_service import model_cache_service
    
    # Only allow admin users to refresh cache
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can refresh the model cache"
        )
    
    try:
        models = await model_cache_service.refresh_model_cache()
        
        return {
            "success": True,
            "message": f"Model cache refreshed successfully",
            "models_found": len(models),
            "refresh_time": model_cache_service.last_refresh.isoformat()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to refresh model cache: {str(e)}"
        }

