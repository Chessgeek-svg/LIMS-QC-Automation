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

class QCResultCreate(BaseModel):
    value: Decimal
    test_id: int
    user_id: Optional[int] = None
    user_comment: Optional[str] = None

class QCResult(QCResultCreate):
    id: int
    test_id: int
    timestamp: datetime
    status: str
    system_comment: str
    user_comment: Optional[str] = None
    supervisor_comment: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class QCResultUpdate(BaseModel):
    user_comment: Optional[str] = None
    #Allow supervisors to override the status if they provide a reason
    status: Optional[str] = None
    supervisor_id: int
    supervisor_comment: Optional[str] = None

class TestStats(BaseModel):
    test_definition: TestDefinition
    recent_results: list[QCResult]
    target_mean: Decimal
    target_sd: Decimal
    actual_mean: Decimal
    actual_sd: Decimal
    plus_2sd: Decimal
    minus_2sd: Decimal
    plus_3sd: Decimal
    minus_3sd: Decimal

class AuditLog(BaseModel):
    id: int
    table_name: str
    record_id: int
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    user_id: Optional[int]
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
