import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEmployee } from '@/hooks/useEmployee'
import { useSalaryHistory } from '@/hooks/useSalaryHistory'
import { formatLocalCurrency, formatUsd } from '@/lib/money'

// A raise-history review essentially always also wants current role/department/pay, so this is
// one dialog rather than a separate "history" view.
export function EmployeeDetailDialog({ employeeId, open, onOpenChange }) {
  const detailQuery = useEmployee(employeeId, { enabled: open })
  const historyQuery = useSalaryHistory(employeeId, { enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>

        {detailQuery.isError ? (
          <p role="alert">Couldn&apos;t load employee.</p>
        ) : !detailQuery.isSuccess ? (
          <p>Loading…</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>
                {detailQuery.data.firstName} {detailQuery.data.lastName}
              </dd>
              <dt className="text-muted-foreground">Employee Code</dt>
              <dd>{detailQuery.data.employeeCode}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{detailQuery.data.email}</dd>
              <dt className="text-muted-foreground">Department</dt>
              <dd>{detailQuery.data.departmentName}</dd>
              <dt className="text-muted-foreground">Country</dt>
              <dd>{detailQuery.data.countryName}</dd>
              <dt className="text-muted-foreground">Job Title</dt>
              <dd>{detailQuery.data.jobTitle}</dd>
              <dt className="text-muted-foreground">Job Level</dt>
              <dd>{detailQuery.data.jobLevel}</dd>
              <dt className="text-muted-foreground">Salary</dt>
              <dd>
                {formatLocalCurrency(detailQuery.data.salaryLocal, detailQuery.data.currencyCode)} (
                {formatUsd(detailQuery.data.salaryUsd)})
              </dd>
              <dt className="text-muted-foreground">Hire Date</dt>
              <dd>{detailQuery.data.hireDate}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{detailQuery.data.employmentStatus}</dd>
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-medium">Salary History</h3>
              {historyQuery.isError ? (
                <p role="alert">Couldn&apos;t load salary history.</p>
              ) : !historyQuery.isSuccess ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : historyQuery.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No salary changes on record.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {historyQuery.data.map((change) => (
                    <li key={change.id}>
                      {formatLocalCurrency(change.oldSalaryLocal, detailQuery.data.currencyCode)} →{' '}
                      {formatLocalCurrency(change.newSalaryLocal, detailQuery.data.currencyCode)} (
                      {change.hikePercent > 0 ? '+' : ''}
                      {change.hikePercent}%) on {change.changedAt.slice(0, 10)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
