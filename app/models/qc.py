from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    model = Column(String)
    serial_number = Column(String, unique=True, index=True)
    
    test_definitions = relationship("TestDefinition", back_populates="instrument")

class TestDefinition(Base):
    __tablename__ = "test_definitions"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"))
    analyte_name = Column(String, nullable=False)
    units = Column(String)
    
    mean = Column(Numeric(precision=10, scale=3), nullable=False)
    std_dev = Column(Numeric(precision=10, scale=3), nullable=False)

    instrument = relationship("Instrument", back_populates="test_definitions")
    results = relationship("QCResult", back_populates="test_definition")

class QCResult(Base):
    __tablename__ = "qc_results"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("test_definitions.id"))
    value = Column(Numeric(precision=10, scale=3), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer)  # To be linked to an Auth system later
    status = Column(String)
    comment = Column(String, nullable=True)

    test_definition = relationship("TestDefinition", back_populates="results")