from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional

class InstrumentBase(BaseModel):
    name: str = Field(..., examples=["Beckman Coulter DxC 700"])
    model: Optional[str] = None
    serial_number: str

class InstrumentCreate(InstrumentBase):
    #Schema for creating a new instrument (Input)
    pass

class Instrument(InstrumentBase):
    #Schema for reading instrument data (Output)
    id: int
    model_config = ConfigDict(from_attributes=True)

class TestDefinitionBase(BaseModel):
    analyte_name: str
    units: str
    mean: Decimal
    std_dev: Decimal

class TestDefinitionCreate(TestDefinitionBase):
    instrument_id: int

class TestDefinition(TestDefinitionBase):
    id: int
    instrument_id: int
    model_config = ConfigDict(from_attributes=True)

class QCResultBase(BaseModel):
    value: Decimal
    comment: Optional[str] = None

class QCResultCreate(QCResultBase):
    test_id: int

class QCResult(QCResultBase):
    id: int
    test_id: int
    timestamp: datetime
    status: str
    model_config = ConfigDict(from_attributes=True)