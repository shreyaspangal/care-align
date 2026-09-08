'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { DocumentActionResult } from '@/actions/documents'

type DeleteDocumentButtonProps = {
  documentId: string
  profileId: string
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  deleteDocument: (documentId: string) => Promise<DocumentActionResult>
}

export function DeleteDocumentButton({
  documentId,
  profileId,
  deleteDocument,
}: DeleteDocumentButtonProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteDocument(documentId)
    setIsDeleting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setOpen(false)
    toast.success('Document deleted')
    router.push(`/p/${profileId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this document?</DialogTitle>
          <DialogDescription>
            This removes the file and its explanation permanently. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
