from fastapi import APIRouter, Depends, HTTPException
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
    
    past_results = db.query(models.QCResult).filter(
        models.QCResult.test_id == result.test_id
    ).order_by(models.QCResult.timestamp.desc()).limit(10).all()

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
    #Only return results that are not archived for now
    #Could add a review mode / supervisor mode to show all results including archived
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
    supervisor_id: int, #Temporary until Auth is added
    db: Session = Depends(get_db)
):
    db_result = db.query(models.QCResult).filter(models.QCResult.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    return crud_qc.update_qc_result(
        db=db, 
        db_result=db_result, 
        obj_in=update_data, 
        supervisor_id=supervisor_id
    )

@router.delete("/results/{result_id}")
def archive_result(result_id: int, supervisor_id: int, db: Session = Depends(get_db)):
    result = crud_qc.archive_qc_result(db, result_id=result_id, supervisor_id=supervisor_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return {
        "status": "success",
        "message": f"Result {result_id} has been archived.",
        "archived_by": supervisor_id,
        "timestamp": datetime.now(),
        "data": result
    }

@router.get("/test-definitions/{test_id}/stats", response_model=schemas_qc.TestStats)
def get_test_stats(test_id: int, db: Session = Depends(get_db)):
    stats = crud_qc.get_test_statistics(db, test_id=test_id)
    if not stats:
        raise HTTPException(
            status_code=404, 
            detail=f"Test definition with ID {test_id} not found or has no results."
        )
    return stats
