import { useState } from 'react';
import { track } from '@fiber-analytics/browser';
import { useToast } from '../toast.js';

/** +/- counter. Each button is a `click`; each named distinctly in the dashboard. */
export function CounterControls() {
  const [count, setCount] = useState(0);
  return (
    <div className="control-block">
      <div className="control-label">Counter</div>
      <div className="row">
        <button className="button" label="decrement" onClick={() => setCount((c) => c - 1)}>
          -
        </button>
        <output className="counter-value">{count}</output>
        <button className="button" label="increment" onClick={() => setCount((c) => c + 1)}>
          +
        </button>
        <button className="button ghost" label="reset" onClick={() => setCount(0)}>
          Reset
        </button>
      </div>
    </div>
  );
}

/** Toggle button emitting a `click` plus a custom `like_toggled` event. */
export function LikeButton() {
  const [liked, setLiked] = useState(false);
  const { notify } = useToast();

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    track('like_toggled', { liked: next });
    if (next) notify('Added to your favorites', 'success');
  };

  return (
    <div className="control-block">
      <div className="control-label">Reaction</div>
      <button
        className={`button like ${liked ? 'active' : ''}`}
        label="like-toggle"
        aria-pressed={liked}
        onClick={toggle}
      >
        {liked ? 'Liked' : 'Like'}
      </button>
    </div>
  );
}

/** Star rating: each star is a `click`; submitting fires a custom event. */
export function RatingStars() {
  const [rating, setRating] = useState(0);
  const { notify } = useToast();

  const choose = (value: number) => {
    setRating(value);
    track('rating_changed', { rating: value });
  };

  return (
    <div className="control-block">
      <div className="control-label">Rating</div>
      <div className="row">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={`star ${value <= rating ? 'filled' : ''}`}
            label={`star-${value}`}
            aria-label={`Rate ${value} stars`}
            onClick={() => choose(value)}
          >
            *
          </button>
        ))}
        <button
          className="button ghost"
          label="submit-rating"
          disabled={rating === 0}
          onClick={() => {
            track('rating_submitted', { rating });
            notify(`Thanks for rating ${rating}/5`, 'success');
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

/** Search input emitting debounced `input` events and a `submit`. */
export function SearchBar() {
  const [value, setValue] = useState('');
  const { notify } = useToast();

  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        track('search_submitted', { length: value.length });
        notify(value ? `Searching for "${value}"` : 'Type something to search');
      }}
    >
      <input
        type="search"
        name="query"
        placeholder="Search products..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="button primary" label="search-submit">
        Search
      </button>
      {value ? (
        <button
          type="button"
          className="button ghost"
          label="search-clear"
          onClick={() => setValue('')}
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}

/** Quantity stepper: buttons (`click`) plus a number input (`state_change`). */
export function QuantityStepper({ initial = 1 }: { initial?: number }) {
  const [qty, setQty] = useState(initial);
  return (
    <div className="stepper">
      <button
        className="button"
        label="qty-decrement"
        disabled={qty <= 0}
        onClick={() => setQty((q) => Math.max(0, q - 1))}
      >
        -
      </button>
      <input
        type="number"
        name="quantity"
        min={0}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value) || 0)}
      />
      <button className="button" label="qty-increment" onClick={() => setQty((q) => q + 1)}>
        +
      </button>
    </div>
  );
}
