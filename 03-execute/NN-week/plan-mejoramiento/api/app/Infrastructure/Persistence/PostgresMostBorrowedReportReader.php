<?php

namespace App\Infrastructure\Persistence;

use App\Application\Ports\MostBorrowedReportReader;
use App\Domain\ValueObjects\DateRange;
use Illuminate\Support\Facades\DB;

final class PostgresMostBorrowedReportReader implements MostBorrowedReportReader
{
    public function rows(DateRange $range): array
    {
        return DB::table('loan_item')->join('loan', 'loan.id', '=', 'loan_item.loan_id')
            ->where('loan.loaned_at', '>=', $range->start)->where('loan.loaned_at', '<', $range->endExclusive)
            ->select('loan_item.article_id', 'loan_item.article_name', 'loan_item.category_name')
            ->selectRaw('COUNT(*) AS times_borrowed')
            ->groupBy('loan_item.article_id', 'loan_item.article_name', 'loan_item.category_name')
            ->orderByDesc('times_borrowed')->orderBy('loan_item.article_name')->orderBy('loan_item.category_name')->orderBy('loan_item.article_id')
            ->get()->map(fn ($row) => ['article_id' => $row->article_id, 'article_name' => $row->article_name,
                'category_name' => $row->category_name, 'times_borrowed' => (int) $row->times_borrowed])->all();
    }
}
