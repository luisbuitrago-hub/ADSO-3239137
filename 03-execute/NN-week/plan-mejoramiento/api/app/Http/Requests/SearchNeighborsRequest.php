<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SearchNeighborsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['q' => ['sometimes', 'nullable', 'string'], 'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
            'size' => ['sometimes', 'integer', 'min:1', 'max:50']];
    }

    public function messages(): array
    {
        return ['string' => 'El campo debe ser texto.', 'integer' => 'El campo debe ser un número entero.',
            'min' => 'El valor debe ser como mínimo uno.', 'max' => 'El campo supera el máximo permitido.'];
    }
}
