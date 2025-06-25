import { useConvex } from 'convex/react';
import { FunctionReference, OptionalRestArgs } from 'convex/server';

const cache = new WeakMap();

export function useQuerySuspense<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: OptionalRestArgs<Query>
) {
  const convex = useConvex();
  const watch = convex.watchQuery(query, ...args);
  const value = watch.localQueryResult();

  if (value === undefined) {
    let promise = cache.get(watch);
    if (!promise) {
      promise = new Promise<void>((resolve) => {
        const unsubscribe = watch.onUpdate(() => {
          unsubscribe(); // avoid memory leaks
          resolve();
        });
      });
      cache.set(watch, promise);
    }
    throw promise;
  }

  return value;
}
