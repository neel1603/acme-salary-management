import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateEmployee } from '@/hooks/useCreateEmployee'
import { useEmployee } from '@/hooks/useEmployee'
import { useLookups } from '@/hooks/useLookups'
import { useUpdateEmployee } from '@/hooks/useUpdateEmployee'
import { formatApiErrorDetail } from '@/lib/apiError'

// The seed data's job-level bands (app/seed/reference_data.py) -- job_level has no backing lookup
// table or endpoint, so this is a plain frontend constant, same as EmployeeFilterBar's status list.
const JOB_LEVELS = ['IC1', 'IC2', 'IC3', 'IC4', 'Senior', 'Staff', 'Manager', 'Director', 'VP']
const EMPLOYMENT_STATUSES = ['Active', 'On Leave', 'Terminated']

const EMPTY_VALUES = {
  firstName: '',
  lastName: '',
  email: '',
  departmentId: undefined,
  countryId: undefined,
  jobTitle: '',
  jobLevel: undefined,
  salaryLocal: '',
  hireDate: '',
}

export function EmployeeFormDialog({ mode, employeeId, open, onOpenChange }) {
  // Edit mode fetches the full detail shape rather than prefilling from the list row: the row
  // (EmployeeSummary) has no salary_local/currency_code/department_id/country_id, and PUT is a
  // full replace -- prefilling from the row would overwrite the employee's real local salary.
  const detailQuery = useEmployee(employeeId, { enabled: open && mode === 'edit' })
  const isReady = mode === 'create' || detailQuery.isSuccess

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        </DialogHeader>

        {mode === 'edit' && detailQuery.isError ? (
          <p role="alert">Couldn&apos;t load employee.</p>
        ) : !isReady ? (
          <p>Loading…</p>
        ) : (
          <EmployeeForm
            mode={mode}
            employeeId={employeeId}
            initialValues={mode === 'edit' ? detailQuery.data : EMPTY_VALUES}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// Mounted only once initialValues is guaranteed real data (see isReady above) -- so this
// useState initializer never reads a field off an undefined query result.
function EmployeeForm({ mode, employeeId, initialValues, onClose }) {
  const { countries, departments } = useLookups()
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const mutation = mode === 'edit' ? updateMutation : createMutation

  const [form, setForm] = useState(initialValues)
  const [salaryJustCleared, setSalaryJustCleared] = useState(false)

  const selectedCountry = countries.data?.find((country) => country.id === form.countryId)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCountryChange(nextCountryId) {
    // Only a *change away from* a previously-selected country risks re-denominating a real
    // amount -- the first pick in create mode has nothing to overwrite yet.
    const shouldClearSalary = form.countryId !== undefined && form.countryId !== nextCountryId
    setForm((prev) => ({ ...prev, countryId: nextCountryId, salaryLocal: shouldClearSalary ? '' : prev.salaryLocal }))
    if (shouldClearSalary) {
      setSalaryJustCleared(true)
    }
  }

  function handleSalaryChange(value) {
    updateField('salaryLocal', value)
    setSalaryJustCleared(false)
  }

  function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      departmentId: form.departmentId,
      countryId: form.countryId,
      jobTitle: form.jobTitle,
      jobLevel: form.jobLevel,
      salaryLocal: Number(form.salaryLocal),
      hireDate: form.hireDate,
      ...(mode === 'edit' ? { employmentStatus: form.employmentStatus } : {}),
    }

    if (mode === 'edit') {
      updateMutation.mutate({ id: employeeId, payload }, { onSuccess: onClose })
    } else {
      createMutation.mutate(payload, { onSuccess: onClose })
    }
  }

  const isValid = Boolean(
    form.firstName &&
      form.lastName &&
      form.email &&
      form.departmentId &&
      form.countryId &&
      form.jobTitle &&
      form.jobLevel &&
      form.salaryLocal &&
      form.hireDate &&
      (mode !== 'edit' || form.employmentStatus),
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mutation.isError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formatApiErrorDetail(mutation.error, 'Could not save employee.')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="employee-form-first-name">First Name</Label>
          <Input
            id="employee-form-first-name"
            required
            value={form.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="employee-form-last-name">Last Name</Label>
          <Input
            id="employee-form-last-name"
            required
            value={form.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="employee-form-email">Email</Label>
        <Input
          id="employee-form-email"
          type="email"
          required
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="employee-form-department">Department</Label>
          <Select
            value={form.departmentId != null ? String(form.departmentId) : null}
            onValueChange={(value) => updateField('departmentId', Number(value))}
          >
            <SelectTrigger id="employee-form-department" className="w-full">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.data?.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="employee-form-country">Country</Label>
          <Select
            value={form.countryId != null ? String(form.countryId) : null}
            onValueChange={(value) => handleCountryChange(Number(value))}
          >
            <SelectTrigger id="employee-form-country" className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.data?.map((country) => (
                <SelectItem key={country.id} value={String(country.id)}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="employee-form-job-title">Job Title</Label>
        <Input
          id="employee-form-job-title"
          required
          value={form.jobTitle}
          onChange={(event) => updateField('jobTitle', event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="employee-form-job-level">Job Level</Label>
          <Select value={form.jobLevel ?? null} onValueChange={(value) => updateField('jobLevel', value)}>
            <SelectTrigger id="employee-form-job-level" className="w-full">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {JOB_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="employee-form-hire-date">Hire Date</Label>
          <Input
            id="employee-form-hire-date"
            type="date"
            required
            value={form.hireDate}
            onChange={(event) => updateField('hireDate', event.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="employee-form-salary">Salary {selectedCountry ? `(${selectedCountry.currencyCode})` : ''}</Label>
        <Input
          id="employee-form-salary"
          type="number"
          min="0"
          step="0.01"
          required
          value={form.salaryLocal}
          onChange={(event) => handleSalaryChange(event.target.value)}
        />
        {salaryJustCleared && (
          <p className="mt-1 text-xs text-amber-600">
            Country changed — re-enter salary in {selectedCountry?.currencyCode}.
          </p>
        )}
      </div>

      {mode === 'edit' && (
        <div>
          <Label htmlFor="employee-form-status">Status</Label>
          <Select value={form.employmentStatus} onValueChange={(value) => updateField('employmentStatus', value)}>
            <SelectTrigger id="employee-form-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}
