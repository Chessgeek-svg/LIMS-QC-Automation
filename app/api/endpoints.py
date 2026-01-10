from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.crud import instrument as crud_instrument
from app.crud import qc as crud_qc
from app.logic.rules_engine import evaluate_westgard, calculate_z_score
from app.models import qc as models
from app.schemas import qc as schemas_qc
from app.db.session import get_db

router = APIRouter()

@router.post("/instruments/", response_model=schemas_qc.Instrument)
def create_instrument(instrument: schemas_qc.InstrumentCreate, db: Session = Depends(get_db)):
    return crud_instrument.create_instrument(db=db, instrument=instrument)

@router.get("/instruments/", response_model=List[schemas_qc.Instrument])
def read_instruments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    instruments = crud_instrument.get_instruments(db, skip=skip, limit=limit)
    return instruments

#Test Definition Endpoints
@router.post("/tests/", response_model=schemas_qc.TestDefinition)
def create_test(test: schemas_qc.TestDefinitionCreate, db: Session = Depends(get_db)):
    return crud_qc.create_test_definition(db=db, test=test)
    
@router.get("/test-definitions/", response_model=List[schemas_qc.TestDefinition])
def read_test_definitions(
    instrument_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    tests = crud_qc.get_test_definitions(db, instrument_id=instrument_id, skip=skip, limit=limit)
    return tests

#QC Result Endpoints
@router.post("/results/", response_model=schemas_qc.QCResult)
def submit_qc_result(result: schemas_qc.QCResultCreate, db: Session = Depends(get_db)):
    #Fetch the test definition to get Mean and SD
    test_def = db.query(models.TestDefinition).filter(
        models.TestDefinition.id == result.test_id
    ).first()

    if not test_def:
        raise HTTPException(status_code=404, detail="Test definition not found")
    
    past_results = db.query(models.QCResult)\
        .filter(models.QCResult.test_id == result.test_id)\
        .filter(models.QCResult.status != "ARCHIVED")\
        .order_by(models.QCResult.timestamp.desc()).limit(10).all()

    history_z = [
        calculate_z_score(
            r.value, 
            test_def.mean, 
            test_def.std_dev
        ) 
        for r in past_results
    ]
    
    if not test_def:
        raise HTTPException(status_code=404, detail="Test definition not found")

    #Run the Rules Engine
    evaluation = evaluate_westgard(
        value=result.value, 
        mean=test_def.mean, 
        std_dev=test_def.std_dev,
        history = history_z
    )

    #Save to database with the new status and message
    return crud_qc.create_qc_result(
        db=db, 
        result=result, 
        status=evaluation.status,
        system_comment=evaluation.message
    )

@router.get("/results/", response_model=List[schemas_qc.QCResult])
def read_results(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    results = db.query(models.QCResult).filter(
        models.QCResult.is_archived == False
    ).offset(skip).limit(limit).all()
    return results

@router.get("/audit-logs/", response_model=List[schemas_qc.AuditLog])
def get_audit_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return logs

@router.patch("/results/{result_id}", response_model=schemas_qc.QCResult)
def update_qc_result(
    result_id: int, 
    update_data: schemas_qc.QCResultUpdate, 
    db: Session = Depends(get_db)
):
    db_result = db.query(models.QCResult).filter(models.QCResult.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    return crud_qc.update_qc_result(
        db=db, 
        db_result=db_result, 
        obj_in=update_data, 
    )

@router.delete("/results/{result_id}")
def archive_result(result_id: int, reviewer_id: int, db: Session = Depends(get_db)):
    raise HTTPException(status_code=403, detail="True deletes are disabled. Use Archive instead.")
    #Holding onto this code for now in case i want to add like an admin privilege to truly delete results
    result = crud_qc.archive_qc_result(db, result_id=result_id, reviewer_id=reviewer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return {
        "status": "success",
        "message": f"Result {result_id} has been archived.",
        "archived_by": reviewer_id,
        "timestamp": datetime.now(),
        "data": result
    }

@router.get("/test-definitions/{test_id}/stats", response_model=schemas_qc.TestStats)
def get_test_stats(
    test_id: int, 
    include_archived: bool = False,
    db: Session = Depends(get_db)
):
    
    stats = crud_qc.get_test_statistics(db, test_id=test_id, include_archived=include_archived)
    
    if not stats:
        raise HTTPException(
            status_code=404, 
            detail=f"Test definition with ID {test_id} not found or has no results."
        )
    return stats

def get_current_user(
    db: Session = Depends(get_db), 
    x_user_id: int = Header(None) # Looks for 'X-User-ID' in the request headers
) -> models.User:
    if x_user_id is None:
        raise HTTPException(status_code=401, detail="User ID header missing")

    query = select(models.User).where(models.User.id == x_user_id)
    user = db.execute(query).scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user

def get_current_supervisor(current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.SUPERVISOR:
        raise HTTPException(
            status_code=403, 
            detail="Operation restricted to Supervisor role."
        )
    return current_user

@router.patch("/test-definitions/{test_id}", response_model=schemas_qc.TestDefinition)
def patch_test_definition(
    test_id: int, 
    payload: dict,
    db: Session = Depends(get_db)
):

    db_test = db.get(models.TestDefinition, test_id)
    if not db_test:
        raise HTTPException(status_code=404, detail="Test definition not found")
        
    updated_test = crud_qc.update_test_definition(db, test_id=test_id, updates=payload)
    return updated_test