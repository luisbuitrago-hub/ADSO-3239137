<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListLoansRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('neighbor_id'))) {
            $this->merge(['neighbor_id' => strtolower($this->input('neighbor_id'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['neighbor_id' => ['sometimes', 'uuid:4'], 'status' => ['sometimes', 'in:open,overdue,closed'],
            'from' => ['sometimes', 'date_format:Y-m-d'], 'to' => ['sometimes', 'date_format:Y-m-d'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'], 'size' => ['sometimes', 'integer', 'min:1', 'max:50']];
    }

    public function messages(): array
    {
        return ['uuid' => 'El identificador debe ser un UUID v4 válido.', 'in' => 'El estado debe ser open, overdue o closed.',
            'date_format' => 'La fecha debe tener el formato AAAA-MM-DD y ser válida.', 'integer' => 'El campo debe ser un número entero.',
            'min' => 'El valor debe ser como mínimo uno.', 'max' => 'El campo supera el máximo permitido.'];
    }
}
