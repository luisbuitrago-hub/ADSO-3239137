<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $presence = $this->isMethod('PUT') ? ['sometimes', 'required'] : ['required'];

        return [
            'name' => [...$presence, 'string', 'max:250'],
            'description' => [...$presence, 'string', 'max:200'],
            'reference' => [...$presence, 'string', 'max:50'],
            'category_id' => [...$presence, 'uuid:4'],
            'total_units' => [...$presence, 'integer', 'min:1', 'max:2147483647', function (string $field, mixed $value, \Closure $fail): void {
                if (is_bool($value)) {
                    $fail('La cantidad debe ser un número entero.');
                }
            }],
            'id' => ['missing'], 'available_units' => ['missing'], 'cover_key' => ['missing'], 'deleted_at' => ['missing'],
        ];
    }

    public function messages(): array
    {
        return ['required' => 'El campo es obligatorio.', 'string' => 'El campo debe ser texto.',
            'max' => 'El campo supera el máximo permitido.', 'min' => 'El valor debe ser como mínimo uno.',
            'integer' => 'La cantidad debe ser un número entero.', 'uuid' => 'El identificador debe ser un UUID v4 válido.',
            'missing' => 'Este campo no puede asignarse mediante esta operación.'];
    }
}
