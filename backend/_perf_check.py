import os
import time

os.environ["DATABASE_URL"] = "sqlite:///./perf_test.db"

from app.database import SessionLocal
from app.schemas.common import EmployeeFilterParams
from app.schemas.employee import EmployeeListParams
from app.services import employee_service, kpi_service

db = SessionLocal()


def timeit(label, fn, n=5):
    times = []
    for _ in range(n):
        start = time.perf_counter()
        fn()
        times.append((time.perf_counter() - start) * 1000)
    print(f"{label:55s} best={min(times):6.2f}ms  avg={sum(times) / n:6.2f}ms")


timeit("KPI summary, Active only", lambda: kpi_service.get_kpi_summary(db, EmployeeFilterParams(employment_status="Active")))
timeit("KPI summary, no filters (All)", lambda: kpi_service.get_kpi_summary(db, EmployeeFilterParams(employment_status="All")))
timeit("Department breakdown, Active only", lambda: kpi_service.get_department_breakdown(db, EmployeeFilterParams(employment_status="Active")))
timeit("Country breakdown, Active only", lambda: kpi_service.get_country_breakdown(db, EmployeeFilterParams(employment_status="Active")))
timeit(
    "Department breakdown, dept+country+date filters",
    lambda: kpi_service.get_department_breakdown(
        db,
        EmployeeFilterParams(employment_status="Active", country_id=1, hire_date_from="2020-01-01", hire_date_to="2025-01-01"),
    ),
)

timeit("Employee list, page 1, default sort", lambda: employee_service.list_employees(db, EmployeeListParams()))
timeit(
    "Employee list, page 1, sort by salary_usd desc",
    lambda: employee_service.list_employees(db, EmployeeListParams(sort_by="salary_usd", sort_dir="desc")),
)
timeit(
    "Employee list, sort by department name",
    lambda: employee_service.list_employees(db, EmployeeListParams(sort_by="department")),
)
timeit(
    "Employee list, filtered dept+status, page 1",
    lambda: employee_service.list_employees(db, EmployeeListParams(department_id=1, employment_status="Active")),
)
timeit(
    "Employee list, free-text search (ilike)",
    lambda: employee_service.list_employees(db, EmployeeListParams(search="ohn")),
)
timeit(
    "Employee list, deep page (page 300)",
    lambda: employee_service.list_employees(db, EmployeeListParams(page=300)),
)

db.close()
