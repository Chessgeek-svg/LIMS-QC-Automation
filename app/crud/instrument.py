from sqlalchemy.orm import Session
from app.models.qc import Instrument
from app.schemas.qc import InstrumentCreate

def get_instrument(db: Session, instrument_id: int):
    """Retrieve a single instrument by its ID"""
    return db.query(Instrument).filter(Instrument.id == instrument_id).first()

def get_instruments(db: Session, skip: int = 0, limit: int = 100):
    """Retrieve a list of instruments (with pagination)"""
    return db.query(Instrument).offset(skip).limit(limit).all()

def create_instrument(db: Session, instrument: InstrumentCreate):
    """Create a new instrument record in the database"""
    db_instrument = Instrument(
        name=instrument.name,
        model=instrument.model,
        serial_number=instrument.serial_number
    )
    db.add(db_instrument)
    db.commit()
    db.refresh(db_instrument)
    return db_instrument