import { Button } from "./button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null

  const prevPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const nextPage = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  return (
    <div className={`flex justify-center gap-2 mt-8 ${className}`}>
      <Button
        onClick={prevPage}
        disabled={currentPage === 1}
        variant="outline"
        className="text-black hover:bg-[#E3C08D]/90 hover:border-[#E3C08D] hover:cursor-pointer"
      >
        Prev
      </Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Button
          key={page}
          onClick={() => onPageChange(page)}
          variant={currentPage === page ? "default" : "outline"}
          className={`${
            currentPage === page
              ? "bg-[#E3C08D] border-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
              : "text-black border-[#E3C08D] hover:bg-[#E3C08D]/90 hover:border-[#E3C08D] hover:cursor-pointer"
          }`}
        >
          {page}
        </Button>
      ))}
      <Button
        onClick={nextPage}
        disabled={currentPage === totalPages}
        variant="outline"
        className="text-black hover:bg-[#E3C08D]/90 hover:border-[#E3C08D] hover:cursor-pointer"
      >
        Next
      </Button>
    </div>
  )
}
