import { useEffect, useMemo, useState } from 'react';

export function FormModal({
  error,
  fields,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
  submitLabel = 'Сохранить',
  title,
}) {
  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ''])),
    [fields],
  );
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
      setErrors({});
    }
  }, [initialValues, isOpen]);

  if (!isOpen) {
    return null;
  }

  function validate() {
    const nextErrors = {};

    fields.forEach((field) => {
      if (field.required && !String(values[field.name] ?? '').trim()) {
        nextErrors[field.name] = 'Заполните обязательное поле.';
        return;
      }

      if (!isBlankValue(values[field.name]) && field.type === 'number' && field.min !== undefined) {
        const numericValue = Number(values[field.name]);

        if (!Number.isFinite(numericValue) || numericValue < field.min) {
          nextErrors[field.name] = field.min === 0
            ? 'Укажите число не меньше нуля.'
            : `Укажите число не меньше ${field.min}.`;
        }
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (validate()) {
      onSubmit(values);
    }
  }

  function renderFieldControl(field) {
    if (field.type === 'textarea') {
      return (
        <textarea
          aria-invalid={errors[field.name] ? 'true' : 'false'}
          onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
          rows={4}
          value={values[field.name]}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          aria-invalid={errors[field.name] ? 'true' : 'false'}
          onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
          value={values[field.name]}
        >
          <option value="">{field.placeholder || 'Выберите значение'}</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        aria-invalid={errors[field.name] ? 'true' : 'false'}
        min={field.min}
        onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
        step={field.step}
        type={field.type || 'text'}
        value={values[field.name]}
      />
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="form-modal-title" aria-modal="true" className="modal" role="dialog">
        <div className="modal__header">
          <h2 id="form-modal-title">{title}</h2>
          <button aria-label="Закрыть" className="icon-button" onClick={onClose} type="button">×</button>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <form className="form-grid" noValidate onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label className="field" key={field.name}>
              <span>
                {field.label}
                {field.required ? <b aria-hidden="true"> *</b> : null}
              </span>

              {renderFieldControl(field)}

              {errors[field.name] ? <span className="field__error">{errors[field.name]}</span> : null}
            </label>
          ))}

          <div className="modal__actions">
            <button className="button button--secondary" onClick={onClose} type="button">Отмена</button>
            <button className="button" disabled={isSaving} type="submit">
              {isSaving ? 'Сохранение...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isBlankValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}
