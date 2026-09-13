import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeactivateEmployee } from '@/hooks/useDeactivateEmployee'
import { formatApiErrorDetail } from '@/lib/apiError'

// PATCH .../deactivate is technically reversible via Edit, but it reads as "letting someone go"
// and shouldn't fire on a misclick -- hence a confirmation step rather than a direct row action.
export function DeactivateEmployeeDialog({ employeeId, employeeName, open, onOpenChange }) {
  const mutation = useDeactivateEmployee()

  function handleConfirm() {
    mutation.mutate(employeeId, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {employeeName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This sets their status to Terminated. You can still edit their record afterward.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {formatApiErrorDetail(mutation.error, 'Could not deactivate employee.')}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending ? 'Deactivating…' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
