from sqlalchemy import Integer, String, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.session import Base
from decimal import Decimal
from datetime import datetime
from typing import Optional

class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String)
    serial_number: Mapped[str] = mapped_column(String, unique=True)
    
    test_definitions = relationship("TestDefinition", back_populates="instrument")

class TestDefinition(Base):
    __tablename__ = "test_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    instrument_id: Mapped[int] = mapped_column(Integer, ForeignKey("instruments.id"))
    analyte_name: Mapped[str] = mapped_column(String, nullable=False)
    units: Mapped[str] = mapped_column(String)
    
    mean: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    std_dev: Mapped[Decimal] = mapped_column(Numeric(10, 3))

    instrument = relationship("Instrument", back_populates="test_definitions")
    results = relationship("QCResult", back_populates="test_definition")

class QCResult(Base):
    __tablename__ = "qc_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    value: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    test_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_definitions.id"))

    user_id: Mapped[int] = mapped_column(Integer) #To be linked to an Auth system later

    status: Mapped[str] = mapped_column(String)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    system_comment: Mapped[str] = mapped_column(String)
    user_comment: Mapped[str] = mapped_column(String, nullable=True)
    supervisor_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    test_definition = relationship("TestDefinition", back_populates="results")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    table_name: Mapped[str] = mapped_column(String)
    record_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String) #CRUD
    old_value: Mapped[str] = mapped_column(String, nullable=True)
    new_value: Mapped[str] = mapped_column(String, nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=True) #For future Auth
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())