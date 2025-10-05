from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, case, cast, Float
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models import (
    User, TestRun, TestResult, Dataset, Question, 
    TestResultParameterScore, EvaluationParameter
)
from app.models.schemas import (
    TestRunAnalytics, CategoryAnalytics, TrendData
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Dashboard Analytics Schemas
class DashboardOverview(BaseModel):
    total_test_runs: int
    average_agent_score: float
    total_success_rate: float
    active_datasets: int
    total_questions_tested: int
    last_30_days_tests: int
    trending_score_change: float  # percentage change from previous period
    user_context: Dict[str, Any]  # Information about data scope for this user


class AgentPerformanceMetrics(BaseModel):
    agent_display_name: str
    agent_id: str
    total_tests: int
    average_score: float
    success_rate: float
    last_test_date: Optional[datetime]
    parameter_scores: Dict[str, float]  # parameter name -> average score


class RecentActivityItem(BaseModel):
    id: int
    name: str
    type: str  # "test_run" or "quick_test"
    status: str
    score: Optional[float]
    agent_name: str
    created_at: datetime
    duration_minutes: Optional[float]
    created_by_name: Optional[str] = None  # User who created this activity
    created_by_email: Optional[str] = None  # Email of the user who created this activity


class PerformanceTrend(BaseModel):
    date: str
    average_score: float
    test_count: int
    success_rate: float


class ParameterPerformance(BaseModel):
    parameter_name: str
    average_score: float
    test_count: int


@router.get("/overview")
async def get_dashboard_overview(
    days: int = 30,
    project_id: Optional[str] = None,  # Filter by specific Google Cloud project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DashboardOverview:
    """Get high-level dashboard overview metrics."""
    
    # Date range for filtering
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    previous_cutoff = cutoff_date - timedelta(days=days)
    
    # Build base query - filter by user permissions
    base_query = db.query(TestRun)
    if current_user.role != "admin":
        base_query = base_query.filter(TestRun.created_by_id == current_user.id)
    
    # Optionally filter by project_id (Google Cloud project access)
    if project_id:
        base_query = base_query.filter(TestRun.project_id == project_id)
    
    # Total test runs (all time)
    total_test_runs = base_query.count()
    
    # Recent test runs (last N days)
    recent_test_runs = base_query.filter(TestRun.created_at >= cutoff_date).count()
    
    # Active datasets (datasets with test runs in the period)
    active_datasets_query = db.query(Dataset.id).distinct()
    if current_user.role != "admin":
        active_datasets_query = active_datasets_query.join(TestRun).filter(
            TestRun.created_by_id == current_user.id,
            TestRun.created_at >= cutoff_date
        )
    else:
        active_datasets_query = active_datasets_query.join(TestRun).filter(
            TestRun.created_at >= cutoff_date
        )
    
    # Add project filter if specified
    if project_id:
        active_datasets_query = active_datasets_query.filter(TestRun.project_id == project_id)
    
    active_datasets = active_datasets_query.count()
    
    # Average agent score and success rate (recent period)
    completed_runs = base_query.filter(
        TestRun.status == "completed",
        TestRun.created_at >= cutoff_date
    ).all()
    
    if completed_runs:
        scores = [run.average_score for run in completed_runs if run.average_score is not None]
        average_score = sum(scores) / len(scores) if scores else 0.0
        success_rate = len([r for r in completed_runs if r.average_score and r.average_score >= 70]) / len(completed_runs) * 100
    else:
        average_score = 0.0
        success_rate = 0.0
    
    # Total questions tested (recent period)
    total_questions = sum(run.completed_questions or 0 for run in completed_runs)
    
    # Trending score change (compare to previous period)
    previous_runs = base_query.filter(
        TestRun.status == "completed",
        TestRun.created_at >= previous_cutoff,
        TestRun.created_at < cutoff_date
    ).all()
    
    if previous_runs:
        prev_scores = [run.average_score for run in previous_runs if run.average_score is not None]
        prev_average = sum(prev_scores) / len(prev_scores) if prev_scores else 0.0
        trending_change = ((average_score - prev_average) / prev_average * 100) if prev_average > 0 else 0.0
    else:
        trending_change = 0.0
    
    # Build user context information
    user_context = {
        "user_role": current_user.role,
        "data_scope": "all_users" if current_user.role == "admin" else "user_only",
        "user_email": current_user.email,
        "has_admin_access": current_user.role == "admin",
        "total_users_in_system": db.query(User).count() if current_user.role == "admin" else 1,
        "date_range_days": days
    }
    
    return DashboardOverview(
        total_test_runs=total_test_runs,
        average_agent_score=round(average_score, 1),
        total_success_rate=round(success_rate, 1),
        active_datasets=active_datasets,
        total_questions_tested=total_questions,
        last_30_days_tests=recent_test_runs,
        trending_score_change=round(trending_change, 1),
        user_context=user_context
    )


@router.get("/performance-trends")
async def get_performance_trends(
    days: int = 30,
    project_id: Optional[str] = None,  # Filter by specific Google Cloud project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[PerformanceTrend]:
    """Get performance trends over time (daily aggregates)."""
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Build base query with user permissions
    base_query = db.query(
        func.date(TestRun.created_at).label('date'),
        func.avg(TestRun.average_score).label('avg_score'),
        func.count(TestRun.id).label('test_count'),
        func.avg(case((TestRun.average_score >= 70, 1), else_=0) * 100).label('success_rate')
    ).filter(
        TestRun.status == "completed",
        TestRun.created_at >= cutoff_date
    )
    
    if current_user.role != "admin":
        base_query = base_query.filter(TestRun.created_by_id == current_user.id)
    
    # Optionally filter by project_id (Google Cloud project access)
    if project_id:
        base_query = base_query.filter(TestRun.project_id == project_id)
    
    trends = base_query.group_by(func.date(TestRun.created_at)).order_by('date').all()
    
    return [
        PerformanceTrend(
            date=str(trend.date),
            average_score=round(trend.avg_score or 0, 1),
            test_count=trend.test_count,
            success_rate=round(trend.success_rate or 0, 1)
        )
        for trend in trends
    ]


@router.get("/agent-performance")
async def get_agent_performance(
    limit: int = 10,
    project_id: Optional[str] = None,  # Filter by specific Google Cloud project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[AgentPerformanceMetrics]:
    """Get performance metrics by agent, optionally filtered by Google Cloud project."""
    
    # Build base query with user permissions
    base_query = db.query(TestRun)
    if current_user.role != "admin":
        base_query = base_query.filter(TestRun.created_by_id == current_user.id)
    
    # Optionally filter by project_id (Google Cloud project access)
    if project_id:
        base_query = base_query.filter(TestRun.project_id == project_id)
    
    # Group by agent and calculate metrics
    agent_stats = base_query.filter(TestRun.status == "completed").with_entities(
        TestRun.agent_display_name,
        TestRun.agent_id,
        TestRun.project_id,  # Include project info
        func.count(TestRun.id).label('total_tests'),
        func.avg(TestRun.average_score).label('avg_score'),
        func.avg(case((TestRun.average_score >= 70, 1), else_=0) * 100).label('success_rate'),
        func.max(TestRun.created_at).label('last_test_date')
    ).group_by(
        TestRun.agent_display_name, 
        TestRun.agent_id, 
        TestRun.project_id
    ).order_by(
        desc('avg_score')  # Order by best performing agents first
    ).limit(limit).all()
    
    result = []
    for stat in agent_stats:
        # Get parameter scores for this agent
        parameter_scores = {}
        if stat.agent_id:
            param_query = db.query(
                EvaluationParameter.name,
                func.avg(cast(TestResultParameterScore.score, Float)).label('avg_score')
            ).join(TestResultParameterScore).join(TestResult).join(TestRun).filter(
                TestRun.agent_id == stat.agent_id,
                TestRun.status == "completed"
            )
            
            if current_user.role != "admin":
                param_query = param_query.filter(TestRun.created_by_id == current_user.id)
            
            if project_id:
                param_query = param_query.filter(TestRun.project_id == project_id)
            
            param_scores = param_query.group_by(EvaluationParameter.name).all()
            parameter_scores = {param.name: round(param.avg_score or 0, 1) for param in param_scores}
        
        # Build agent display name with project context
        agent_display = stat.agent_display_name or "Unknown Agent"
        if stat.project_id and current_user.role == "admin":
            agent_display = f"{agent_display} ({stat.project_id})"
        
        result.append(AgentPerformanceMetrics(
            agent_display_name=agent_display,
            agent_id=stat.agent_id or "",
            total_tests=stat.total_tests,
            average_score=round(stat.avg_score or 0, 1),
            success_rate=round(stat.success_rate or 0, 1),
            last_test_date=stat.last_test_date,
            parameter_scores=parameter_scores
        ))
    
    return result


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    project_id: Optional[str] = None,  # Filter by specific Google Cloud project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[RecentActivityItem]:
    """Get recent test run activity."""
    
    # Build base query with user permissions and join with User table
    base_query = db.query(TestRun).options(joinedload(TestRun.created_by))
    if current_user.role != "admin":
        base_query = base_query.filter(TestRun.created_by_id == current_user.id)
    
    # Optionally filter by project_id (Google Cloud project access)
    if project_id:
        base_query = base_query.filter(TestRun.project_id == project_id)
    
    recent_runs = base_query.order_by(desc(TestRun.created_at)).limit(limit).all()
    
    result = []
    for run in recent_runs:
        duration = None
        if run.completed_at and run.started_at:
            duration = (run.completed_at - run.started_at).total_seconds() / 60
        
        # Get creator information
        creator_name = "Unknown User"
        creator_email = None
        if run.created_by:
            creator_name = run.created_by.full_name
            creator_email = run.created_by.email
        
        result.append(RecentActivityItem(
            id=run.id,
            name=run.name,
            type="test_run",
            status=run.status,
            score=run.average_score,
            agent_name=run.agent_display_name or "Unknown Agent",
            created_at=run.created_at,
            duration_minutes=round(duration, 1) if duration else None,
            created_by_name=creator_name,
            created_by_email=creator_email
        ))
    
    return result


@router.get("/parameter-performance")
async def get_parameter_performance(
    days: int = 30,
    project_id: Optional[str] = None,  # Filter by specific Google Cloud project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[ParameterPerformance]:
    """Get performance breakdown by evaluation parameters."""
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Build query with user permissions
    param_query = db.query(
        EvaluationParameter.name,
        func.avg(cast(TestResultParameterScore.score, Float)).label('avg_score'),
        func.count(TestResultParameterScore.id).label('test_count')
    ).join(TestResultParameterScore).join(TestResult).join(TestRun).filter(
        TestRun.status == "completed",
        TestRun.created_at >= cutoff_date
    )
    
    if current_user.role != "admin":
        param_query = param_query.filter(TestRun.created_by_id == current_user.id)
    
    # Optionally filter by project_id (Google Cloud project access)
    if project_id:
        param_query = param_query.filter(TestRun.project_id == project_id)
    
    param_stats = param_query.group_by(EvaluationParameter.name).all()
    
    return [
        ParameterPerformance(
            parameter_name=stat.name,
            average_score=round(stat.avg_score or 0, 1),
            test_count=stat.test_count
        )
        for stat in param_stats
    ]