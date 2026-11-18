<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MostBorrowedReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['from' => ['required', 'string'], 'to' => ['required', 'string']];
    }

    public function messages(): array
    {
        return ['required' => 'El campo es obligatorio.', 'string' => 'La fecha debe ser texto con formato AAAA-MM-DD.'];
    }
}
