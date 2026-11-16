<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $changes = [];
        if (is_string($this->input('neighbor_id'))) {
            $changes['neighbor_id'] = strtolower($this->input('neighbor_id'));
        }
        if (is_array($this->input('items'))) {
            $changes['items'] = array_map(function ($item) {
                if (is_array($item) && isset($item['article_id']) && is_string($item['article_id'])) {
                    $item['article_id'] = strtolower($item['article_id']);
                }

                return $item;
            }, $this->input('items'));
        }
        $this->merge($changes);
    }

    public function rules(): array
    {
        return ['neighbor_id' => ['required', 'uuid:4'], 'items' => ['required', 'array', 'list', 'min:1', 'max:3'],
            'items.*' => ['required', 'array:article_id'], 'items.*.article_id' => ['required', 'uuid:4'],
            'id' => ['missing'], 'loaned_at' => ['missing'], 'loaned_by_user_id' => ['missing'], 'status' => ['missing']];
    }

    public function messages(): array
    {
        return ['required' => 'El campo es obligatorio.', 'uuid' => 'El identificador debe ser un UUID v4 válido.',
            'array' => 'Los artículos deben enviarse como líneas con el identificador del artículo.',
            'list' => 'Los artículos deben enviarse como una lista.', 'min' => 'El préstamo debe contener entre uno y tres artículos.',
            'max' => 'El préstamo debe contener entre uno y tres artículos.', 'missing' => 'Este campo no puede asignarse mediante esta operación.'];
    }
}
