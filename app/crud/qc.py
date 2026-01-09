import json
import statistics
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from app.models import qc as models
from app.schemas import qc as schemas
from typing import Optional
from decimal import Decimal


#Test Definition CRUD
def create_test_definition(db: Session, test: schemas.TestDefinitionCreate):
    db_test = models.TestDefinition(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test

def get_test_definitions(db: Session, instrument_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.TestDefinition)
    #If looking for tests only on a given instrument, else just return all tests
    if instrument_id:
        query = query.filter(models.TestDefinition.instrument_id == instrument_id)
    return query.offset(skip).limit(limit).all()

#QC Result CRUD
def create_qc_result(db: Session, result: schemas.QCResultCreate, status: str, system_comment: str):
    #Ideally the analyzer would always pass a user_id, but this ensures that even if one isn't supplied, the result still posts
    acting_user = result.user_id if result.user_id is not None else 1

    db_result = models.QCResult(
        value=result.value,
        test_id=result.test_id,
        user_comment=result.user_comment,
        user_id=acting_user,
        system_comment=system_comment,
        status=status
    )
    db.add(db_result)
    db.flush()

    audit_data = {
        "value": str(result.value),
        "status": status,
        "system_comment": system_comment
    }
    db_audit = models.AuditLog(
        table_name="qc_results",
        record_id=db_result.id,
        action="CREATE",
        new_value=json.dumps(audit_data),
        user_id=acting_user
    )
    db.add(db_audit)
    db.commit()  
    db.refresh(db_result)
    return db_result

def update_qc_result(db: Session, db_result: models.QCResult, obj_in: schemas.QCResultUpdate):
    old_data = jsonable_encoder(db_result)
    
    update_data = obj_in.model_dump(exclude_unset=True)
    supervisor_id = update_data.pop("supervisor_id", None)
    for field in update_data:
        setattr(db_result, field, update_data[field])
    
    db.add(db_result)
    db.flush()

    new_data = jsonable_encoder(db_result)

    db_audit = models.AuditLog(
        table_name="qc_results",
        record_id=db_result.id,
        action="UPDATE",
        old_value=json.dumps(old_data),
        new_value=json.dumps(new_data),
        user_id=supervisor_id
    )
    
    db.add(db_audit)
    db.commit()
    db.refresh(db_result)
    return db_result

def archive_qc_result(db: Session, result_id: int, supervisor_id: int):
    db_result = db.query(models.QCResult).filter(models.QCResult.id == result_id).first()
    if not db_result:
        return None

    old_data = jsonable_encoder(db_result)
    db_result.is_archived = True
    
    db.add(db_result)
    db.flush()

    db_audit = models.AuditLog(
        table_name="qc_results",
        record_id=db_result.id,
        action="ARCHIVE",
        old_value=json.dumps(old_data),
        new_value=json.dumps({"is_archived": True}),
        user_id=supervisor_id
    )
    
    db.add(db_audit)
    db.commit()
    return db_result

def get_test_statistics(db: Session, test_id: int, limit: int = 30, include_archived: bool = False):
    test_def = db.query(models.TestDefinition).filter(models.TestDefinition.id == test_id).first()
    
    query = db.query(models.QCResult).filter(models.QCResult.test_id == test_id)

    if not include_archived:
        query = query.filter(models.QCResult.status != "ARCHIVED")

    results = query.order_by(models.QCResult.timestamp.desc()).limit(limit).all()

    if not results or not test_def:
        return None

    stats_values = [float(r.value) for r in results if r.status != "ARCHIVED"]
    
    if stats_values:
        actual_mean = statistics.mean(stats_values)
        actual_sd = statistics.stdev(stats_values) if len(stats_values) > 1 else 0
    else:
        actual_mean = 0
        actual_sd = 0

    return {
        "test_definition": test_def,
        "recent_results": results[::-1],
        "target_mean": test_def.mean,
        "target_sd": test_def.std_dev,
        "actual_mean": Decimal(str(round(actual_mean, 3))),
        "actual_sd": Decimal(str(round(actual_sd, 3))),
        "plus_2sd": test_def.mean + (test_def.std_dev * 2),
        "minus_2sd": test_def.mean - (test_def.std_dev * 2),
        "plus_3sd": test_def.mean + (test_def.std_dev * 3),
        "minus_3sd": test_def.mean - (test_def.std_dev * 3),

    }
