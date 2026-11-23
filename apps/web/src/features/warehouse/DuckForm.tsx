import { useId, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ApiError } from '../../api/client';
import { useCreateDuck, useUpdateDuck } from '../../api/ducks';
import {
  COLORS,
  SIZES,
  type Color,
  type CreateDuckInput,
  type Duck,
  type DuckWriteResult,
  type Size,
  type UpdateDuckInput,
} from '../../api/types';
import { Modal } from '../../components/Modal';
import { parsePrice, parseQuantity } from './duckFormValidation';

type Field = 'color' | 'size' | 'price' | 'quantity';
type FieldErrors = Partial<Record<Field, string>>;

interface CommonProps {
  /** The user cancelled. */
  onClose: () => void;
  /** Focus target on close if the trigger is gone (an edit that merged the duck away). */
  focusFallback?: RefObject<HTMLElement | null>;
}

export type DuckFormProps = CommonProps &
  (
    | { mode: 'create'; duck?: undefined; onSaved: (result: DuckWriteResult, sent: CreateDuckInput) => void }
    | {
        mode: 'edit';
        duck: Duck;
        onSaved: (result: DuckWriteResult, sent: UpdateDuckInput) => void;
        /**
         * 404: the duck was deleted or merged away, so editing it no longer makes sense. A 409
         * (concurrent write) is not passed here: it shows inline and the user can resubmit.
         */
        onNotFound: (error: ApiError) => void;
      }
  );

/**
 * The Add and Edit form, in a modal. Edit mode locks color and size (the API rejects them)
 * and sends only the fields that changed.
 */
export function DuckForm(props: DuckFormProps) {
  const { mode, duck, onClose, focusFallback } = props;
  const isEdit = mode === 'edit';
  const ids = { color: useId(), size: useId(), price: useId(), quantity: useId(), locked: useId() };

  const [color, setColor] = useState<Color | ''>(duck?.color ?? '');
  const [size, setSize] = useState<Size | ''>(duck?.size ?? '');
  const [price, setPrice] = useState(duck ? duck.price.toFixed(2) : '');
  const [quantity, setQuantity] = useState(duck ? String(duck.quantity) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const create = useCreateDuck();
  const update = useUpdateDuck();
  const pending = create.isPending || update.isPending;

  function edit<T>(field: Field, setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setErrors((current) => ({ ...current, [field]: undefined }));
      setFormErrors([]);
    };
  }

  function showServerError(error: Error) {
    setFormErrors(error instanceof ApiError ? error.messages : [error.message]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const parsedPrice = parsePrice(price);
    const parsedQuantity = parseQuantity(quantity, isEdit ? 0 : 1);
    const nextErrors: FieldErrors = {
      color: color === '' ? 'Choose a color.' : undefined,
      size: size === '' ? 'Choose a size.' : undefined,
      price: parsedPrice.error,
      quantity: parsedQuantity.error,
    };
    setErrors(nextErrors);
    setFormErrors([]);
    if (Object.values(nextErrors).some(Boolean)) return;

    const priceValue = parsedPrice.value!;
    const quantityValue = parsedQuantity.value!;

    if (props.mode === 'create') {
      const input: CreateDuckInput = {
        color: color as Color,
        size: size as Size,
        price: priceValue,
        quantity: quantityValue,
      };
      create.mutate(input, {
        onSuccess: (result) => props.onSaved(result, input),
        onError: showServerError,
      });
      return;
    }

    const input: UpdateDuckInput = {};
    if (priceValue !== props.duck.price) input.price = priceValue;
    if (quantityValue !== props.duck.quantity) input.quantity = quantityValue;
    if (Object.keys(input).length === 0) {
      setFormErrors(['Nothing to save: price and quantity are unchanged.']);
      return;
    }
    const { onSaved, onNotFound } = props;
    update.mutate(
      { id: props.duck.id, input },
      {
        onSuccess: (result) => onSaved(result, input),
        // Anything but a 404, including a 409, stays inline with the typed values kept.
        onError: (error) => {
          if (error instanceof ApiError && error.isNotFound) onNotFound(error);
          else showServerError(error);
        },
      },
    );
  }

  return (
    <Modal
      title={isEdit ? `Edit duck #${duck!.id}` : 'Add Duck'}
      onClose={onClose}
      canClose={!pending}
      focusFallback={focusFallback}
    >
      <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
        {formErrors.length > 0 && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {formErrors.length === 1 ? (
              <p>{formErrors[0]}</p>
            ) : (
              <ul className="list-disc pl-5">
                {formErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isEdit && (
          <p id={ids.locked} className="text-sm text-gray-500">
            Color and size can't be changed. Only price and quantity are editable.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id={ids.color} label="Color" error={errors.color}>
            <select
              id={ids.color}
              value={color}
              onChange={(e) => edit('color', setColor)(e.target.value as Color)}
              disabled={isEdit}
              aria-invalid={errors.color ? true : undefined}
              aria-describedby={describedBy(ids.color, errors.color, isEdit ? ids.locked : undefined)}
              className={inputClass(errors.color)}
            >
              {!isEdit && <option value="">Select a color</option>}
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id={ids.size} label="Size" error={errors.size}>
            <select
              id={ids.size}
              value={size}
              onChange={(e) => edit('size', setSize)(e.target.value as Size)}
              disabled={isEdit}
              aria-invalid={errors.size ? true : undefined}
              aria-describedby={describedBy(ids.size, errors.size, isEdit ? ids.locked : undefined)}
              className={inputClass(errors.size)}
            >
              {!isEdit && <option value="">Select a size</option>}
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id={ids.price} label="Price (USD)" error={errors.price}>
            <input
              id={ids.price}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={price}
              onChange={(e) => edit('price', setPrice)(e.target.value)}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={describedBy(ids.price, errors.price)}
              className={inputClass(errors.price)}
            />
          </FormField>

          <FormField id={ids.quantity} label="Quantity" error={errors.quantity}>
            <input
              id={ids.quantity}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={isEdit ? '0' : '1'}
              value={quantity}
              onChange={(e) => edit('quantity', setQuantity)(e.target.value)}
              aria-invalid={errors.quantity ? true : undefined}
              aria-describedby={describedBy(ids.quantity, errors.quantity)}
              className={inputClass(errors.quantity)}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Duck'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error: string | undefined, extra?: string): string | undefined {
  const parts = [error ? `${id}-error` : undefined, extra].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function inputClass(error: string | undefined): string {
  return `block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-offset-0 disabled:bg-gray-100 disabled:text-gray-500 ${
    error ? 'border-red-500 focus:outline-red-500' : 'border-gray-300 focus:outline-blue-600'
  }`;
}
