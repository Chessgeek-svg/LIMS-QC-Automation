from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, cast
from decimal import Decimal

from app.crud import instrument as crud_instrument
from app.crud import qc as crud_qc
from app.crud.qc import get_test_definitions
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