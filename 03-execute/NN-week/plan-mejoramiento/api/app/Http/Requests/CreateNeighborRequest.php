<?php

namespace App\Http\Requests;

use App\Domain\ValueObjects\DocumentNumber;
use Illuminate\Foundation\Http\FormRequest;

class CreateNeighborRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('document_number'))) {
            $this->merge(['document_number' => DocumentNumber::normalize($this->input('document_number'))]);
        }
    }

    public function rules(): array
    {
        return ['full_name' => ['required', 'string', 'max:200'],
            'document_number' => ['required', 'string', 'max:30'], 'id' => ['missing'], 'active_loans' => ['missing']];
    }

    public function messages(): array
    {
        return ['required' => 'El campo es obligatorio.', 'string' => 'El campo debe ser texto.',
            'max' => 'El campo supera la longitud permitida.', 'missing' => 'Este campo no puede asignarse mediante esta operación.'];
    }
}
