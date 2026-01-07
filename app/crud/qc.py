from sqlalchemy.orm import Session
from app.models import qc as models
from app.schemas import qc as schemas

#Test Definition CRUD
def create_test_definition(db: Session, test: schemas.TestDefinitionCreate):
    db_test = models.TestDefinition(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test

def get_test_definitions(db: Session, instrument_id: int):
    return db.query(models.TestDefinition).filter(
        models.TestDefinition.instrument_id == instrument_id
    ).all()

#QC Result CRUD
def create_qc_result(db: Session, result: schemas.QCResultCreate, status: str, system_comment: str):
    db_result = models.QCResult(
        value=result.value,
        test_id=result.test_id,
        user_comment=result.user_comment,
        system_comment=system_comment,
        status=status
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result
