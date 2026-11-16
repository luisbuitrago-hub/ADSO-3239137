<?php

namespace App\Http\Requests;

use App\Domain\ValueObjects\Username;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge(['username' => Username::normalize($this->input('username'))]);
        }
    }

    public function rules(): array
    {
        return ['username' => ['required', 'string', 'max:120'], 'password' => ['required', 'string']];
    }

    public function messages(): array
    {
        return [
            'required' => 'El campo es obligatorio.', 'string' => 'El campo debe ser texto.',
            'max' => 'El campo supera la longitud permitida.', 'in' => 'Solo se permite el rol operator.',
        ];
    }
}
