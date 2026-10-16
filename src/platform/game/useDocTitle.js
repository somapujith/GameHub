import { useEffect } from 'react';

/** Sets `document.title` while the calling screen is mounted (index.html only has one static title). */
export default function useDocTitle(title) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
