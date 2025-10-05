from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.services.dialogflow_service import DialogflowService
from app.core.validation import validate_session_parameters
from app.models.schemas import (
    DialogflowAgent, 
    DialogflowFlow, 
    DialogflowPage, 
    QuickTestRequest, 
    QuickTestResponse
)
from app.api.auth import get_current_user
from app.models import User
from app.core.database import get_db
from datetime import datetime

router = APIRouter()


@router.get("/projects")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all Google Cloud projects accessible to the authenticated user."""
    service = DialogflowService(user=current_user, db=db)
    projects = await service.list_projects()
    return projects


@router.get("/agents", response_model=List[DialogflowAgent])
async def list_agents(
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all Dialogflow CX agents accessible to the authenticated user."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    agents = await service.list_agents()
    return [DialogflowAgent(**agent) for agent in agents]


@router.get("/agents/{agent_id}/flows", response_model=List[DialogflowFlow])
async def list_agent_flows(
    agent_id: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all flows for a specific agent by agent ID."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    flows = await service.get_agent_flows(agent_id)
    return [DialogflowFlow(**flow) for flow in flows]


@router.get("/agents/{agent_name:path}/flows", response_model=List[DialogflowFlow])
async def list_flows(
    agent_name: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all flows for a specific agent by agent name."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    flows = await service.list_flows(agent_name)
    return [DialogflowFlow(**flow) for flow in flows]


@router.get("/agents/{agent_id}/flows/{flow_id}/pages", response_model=List[DialogflowPage])
async def list_flow_pages(
    agent_id: str,
    flow_id: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all pages for a specific flow by agent and flow ID."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    pages = await service.get_flow_pages(agent_id, flow_id)
    return [DialogflowPage(**page) for page in pages]


@router.get("/flows/{flow_name:path}/pages", response_model=List[DialogflowPage])
async def list_pages(
    flow_name: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all pages for a specific flow by flow name."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    pages = await service.list_pages(flow_name)
    return [DialogflowPage(**page) for page in pages]


@router.get("/agents/{agent_name:path}/playbooks")
async def list_playbooks(
    agent_name: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all playbooks for a specific agent by agent name."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    playbooks = await service.list_playbooks(agent_name)
    return playbooks


@router.get("/agents/{agent_name:path}/start-resources")
async def list_start_resources(
    agent_name: str,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all start resources (flows and playbooks) for a specific agent by agent name."""
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    start_resources = await service.list_start_resources(agent_name)
    # Return just the 'all' array that contains the flat list of start resources
    return start_resources.get("all", [])


@router.post("/quick-test", response_model=QuickTestResponse)
async def quick_test(
    test_request: QuickTestRequest,
    project_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quickly test a prompt against a Dialogflow agent.
    
    This endpoint allows you to send a single prompt to a specific agent,
    optionally specifying the flow, page, or playbook to start from.
    """
    # Validate session parameters for duplicates and format
    validated_session_parameters = validate_session_parameters(
        test_request.session_parameters, 
        context="quick test"
    )
    
    service = DialogflowService(user=current_user, db=db, project_id=project_id)
    
    try:
        result = await service.quick_test(
            agent_id=test_request.agent_id,
            prompt=test_request.prompt,
            flow_id=test_request.flow_id,
            page_id=test_request.page_id,
            playbook_id=test_request.playbook_id,
            model_id=test_request.llm_model_id,
            session_id=test_request.session_id,
            session_parameters=validated_session_parameters,
            enable_webhook=test_request.enable_webhook,
            pre_prompt_messages=test_request.pre_prompt_messages,
            post_prompt_messages=test_request.post_prompt_messages
        )
        
        # Convert to response model
        response = QuickTestResponse(
            prompt=result["prompt"],
            response=result["response"],
            agent_id=result["agent_id"],
            flow_id=result.get("flow_id"),
            page_id=result.get("page_id"),
            playbook_id=result.get("playbook_id"),
            llm_model_id=result.get("model_id"),
            session_id=result["session_id"],
            response_time_ms=result["response_time_ms"],
            intent=result.get("intent"),
            confidence=result.get("confidence"),
            parameters=result.get("parameters", {}),
            response_messages=result.get("response_messages", []),
            dialogflow_response=result.get("dialogflow_response"), # Pass through the full response
            webhook_info=result.get("webhook_info"),  # Add webhook_info field
            is_mock=result.get("is_mock", False),
            message_sequence=result.get("message_sequence"),
            sequence_summary=result.get("sequence_summary"),
            created_at=datetime.now()
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
