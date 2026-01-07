from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel

class ValidationResult(BaseModel):
    status: str
    message: str

def calculate_z_score(value: Decimal, mean: Decimal, std_dev: Decimal) -> Decimal:
    if std_dev == 0: return Decimal("0")
    return (value - mean) / std_dev

def evaluate_westgard(value: Decimal, mean: Decimal, std_dev: Decimal, history:List[Decimal]) -> ValidationResult:
    current_z = calculate_z_score(value, mean, std_dev)

    #Rule 1-3s: REJECT (Random Error)
    if abs(current_z) > 3:
        return ValidationResult(status="REJECT", message="Rule 1-3s Violation: Result exceeds 3SD")
    
    #Rule 2-2s: REJECT (Systemic Error)
    if len(history) > 1:
        prev_z = history[0]
        if (current_z > 2 and prev_z > 2) or (current_z < -2 and prev_z < -2):
            return ValidationResult(status="REJECT", message="2-2s Violation")
        
    #Rule R-4s: REJECT (Random Error)
    if len(history) >= 1:
        if abs(current_z - history[0]) >= 4:
            return ValidationResult(status="REJECT", message="R-4s Violation")    

    #Rule 4-1s: REJECT (Systematic Error)
    if len(history) >= 3:
        last_4 = [current_z] + history[:3]
        if all(z > 1 for z in last_4) or all(z < -1 for z in last_4):
            return ValidationResult(status="REJECT", message="4-1s Violation")

    #Rule 10-x: REJECT (Systematic Error/Bias)
    if len(history) >= 9:
        last_10 = [current_z] + history[:9]
        if all(z > 0 for z in last_10) or all(z < 0 for z in last_10):
            return ValidationResult(status="REJECT", message="10-x Violation")

    #Rule 1-2s: WARNING (Random Error)
    if abs(current_z) > 2:
        return ValidationResult(status="WARNING", message="Rule 1-2s Warning: Result exceeds 2SD")
        
    return ValidationResult(status="PASS", message="Results within acceptable limits")