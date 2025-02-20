const FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
  PENDING = 'pending';

interface _BuiltinRecord<T> {
  Value: T;
}
interface MyPromiseWithResolvers<T> {
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  promise: MyPromise<T>;
}
type PromiseAble<T> = T | MyPromise<T> | Promise<T>;
class _PromiseBuiltinFunction<T> {
  /**
   * By the time when the builtin function is called, it will get the "active function object"
   *
   * However, the way to get the "active function object" in javascript is "arguments.callee", which is not recommended.
   * So I was forced to abandon the idea of _PromiseBuiltinFunction extends from Function
   *   and instead make the function a member of the object and manually pass arguments to it when the call method executes
   */
  Promise: MyPromise<T>;
  AlreadyResolved: _BuiltinRecord<boolean>;
  __func: (activeFunctionObject: _PromiseBuiltinFunction<T>, ...args: any[]) => void;
  constructor(
    Promise: MyPromise<T>,
    AlreadyResolved: _BuiltinRecord<boolean>,
    __func: (activeFunctionObject: _PromiseBuiltinFunction<T>, ...args: any[]) => void
  ) {
    this.Promise = Promise;
    this.AlreadyResolved = AlreadyResolved;
    this.__func = __func;
  }
  call(...args: any[]) {
    this.__func.call(globalThis, this, ...args);
  }
}
type PromiseObject<T> = Promise<T> | MyPromise<T>;

function __HostPromiseRejectionTracker<T>(_promise: MyPromise<T>, _operation: 'handle' | 'reject') {
  /**As the function defined in ECMA-262
   *  The host-defined abstract operation HostPromiseRejectionTracker takes arguments promise (a Promise) and
   *  operation ("reject" or "handle") and returns UNUSED. It allows host environments to track promise rejections.
   *  The default implementation of HostPromiseRejectionTracker is to return UNUSED
   *
   * We can't do any host-related Track operations, so I'll just ignore it
   */
}

const runMicroTask = (() => {
  /*
    This function will try to find a way to run a microtask.
    If it can't find a way, it will throw an error.
   */
  if (typeof queueMicrotask === 'function') return queueMicrotask;
  if (typeof process === 'object' && typeof process.nextTick === 'function')
    return process.nextTick;
  if (typeof MutationObserver === 'function')
    return (fn: () => void) => {
      const dom = document.createElement('div');
      new MutationObserver(fn).observe(dom, { attributes: true });
      dom.setAttribute('a', '1');
    };
  if (typeof setTimeout === 'function') return setTimeout;
  throw new Error("Couldn't find a way to run a microtask, even if setTimeout was allowed");
})();
function IsObject(x: any) {
  /** The words defined in ECMA-262 is "is an object"
   */
  return typeof x === 'object' || typeof x === 'function';
}
function IsPromise(x: any) {
  /** As the function defined in ECMA-262:
   *   If x is not an Object, return false.
   *   If x does not have a [[PromiseState]] internal slot, return false.
   *   Return true
   *
   * However, at the javascript level, we can't simulate this because we don't have access to what are called "internal property"
   * So I'll use instanceof instead.
   */
  if (!IsObject(x)) return false;
  return x instanceof Promise || x instanceof MyPromise;
}
function IsCallable(x: any) {
  /** As the function defined in ECMA-262:
   *   If argument is not an Object, return false.
   *   If argument has a [[Call]] internal method, return true.
   *   Return false.
   *
   * However, at the javascript level, we can't find the [[Call]] internal method.
   * So I'll use typeof to check if it's a function.
   */
  if (typeof x !== 'function') return false;
  return true;
}
class MyPromise<T> {
  private PromiseState: typeof PENDING | typeof FULFILLED | typeof REJECTED = PENDING;
  private PromiseResult: T | any;
  private PromiseFulfillReactions: ((value: T) => void)[] | undefined = [];
  private PromiseRejectReactions: ((reason: any) => void)[] | undefined = [];
  private PromiseIsHandled: boolean = false;
  private static _CreateResolvingFunctions<K>(promise: MyPromise<K>) {
    const alreadyResolved: _BuiltinRecord<boolean> = { Value: false };
    const resolve = new _PromiseBuiltinFunction<K>(
      promise,
      alreadyResolved,
      (activeFunctionObject, value: PromiseAble<K>) => {
        if (!activeFunctionObject.Promise || !IsObject(activeFunctionObject.Promise))
          throw new Error('Promise is not defined');
        if (activeFunctionObject.AlreadyResolved.Value) return void 0;
        activeFunctionObject.AlreadyResolved.Value = true;
        if (value === activeFunctionObject.Promise) {
          const selfResolutionError = new TypeError('A promise cannot be resolved with itself');
          MyPromise.RejectPromise(activeFunctionObject.Promise, selfResolutionError);
          return;
        }
        if (!IsObject(value)) {
          MyPromise.FulfillPromise(
            activeFunctionObject.Promise as MyPromise<PromiseAble<K>>,
            value
          );
          return;
        } else if (false) {
          /** As the steps defined in ECMA-262:
           *  Let then be Completion(Get(resolution, "then")).
           *  If then is an abrupt completion, then:
           *    Enter this sub branch
           *
           * The Completion Record specification type is used to explain the runtime propagation of values and control flow
           * in such as the behaviour of statements (break, continue, return and throw) that perform nonlocal transfers of control.
           *
           * The Completion Record's type should be one of the following:
           *    NORMAL, BREAK, CONTINUE, RETURN, or THROW
           *
           * And the abrupt completion refers to any Completion Record with a [[Type]] value other than NORMAL.
           *
           * This is done internally at runtime, so I'll simply ignore it
           */
          MyPromise.RejectPromise(
            activeFunctionObject.Promise,
            'Completion(Get(resolution, "then")).[[Value]]'
          );
          return void 0;
        }
        const thenAction = activeFunctionObject.Promise.then; // In fact, it is the Completion(Get(resolution, "then")).[[Value]]
        if (!IsCallable(thenAction)) {
          MyPromise.RejectPromise(
            activeFunctionObject.Promise,
            new TypeError('then is not a function')
          );
          return void 0;
        }
        // @ts-expect-error 2684
        (thenAction as InstanceType<typeof MyPromise<K>>['then']).call(
          activeFunctionObject.Promise,
          (value: K) => MyPromise.FulfillPromise(activeFunctionObject.Promise, value),
          (reason: any) => MyPromise.RejectPromise(activeFunctionObject.Promise, reason)
        );
      }
    );

    const reject = new _PromiseBuiltinFunction<K>(
      promise,
      alreadyResolved,
      (activeFunctionObject, reason) => {
        if (!activeFunctionObject.Promise || !IsObject(activeFunctionObject.Promise))
          throw new Error('Promise is not defined');
        if (activeFunctionObject.AlreadyResolved.Value) return void 0;
        activeFunctionObject.AlreadyResolved.Value = true;
        MyPromise.RejectPromise(activeFunctionObject.Promise, reason);
      }
    );
    return {
      resolve: resolve.call as (value: PromiseAble<K>) => void,
      reject: reject.call as (reason: any) => void,
    };
  }
  constructor(
    executor: (resolve: (value: PromiseAble<T>) => void, reject: (reason: any) => void) => void
  ) {
    if (new.target === void 0) throw new TypeError('Promise must be called with new');
    if (!IsCallable(executor)) throw new TypeError('executor must be a function');
    const resolvingFunctions = MyPromise._CreateResolvingFunctions<T>(this);
    try {
      executor(resolvingFunctions.resolve, resolvingFunctions.reject);
    } catch (e) {
      resolvingFunctions.reject(e);
    }
  }
  private static RejectPromise<T>(promise: MyPromise<T>, reason: any) {
    if (promise.PromiseState !== PENDING) throw new Error('The promise state is not PENDING');
    const reactions = promise.PromiseRejectReactions;
    promise.PromiseResult = reason;
    promise.PromiseFulfillReactions = void 0;
    promise.PromiseRejectReactions = void 0;
    promise.PromiseState = REJECTED;
    if (!promise.PromiseIsHandled) {
      __HostPromiseRejectionTracker(promise, 'reject');
    }
    MyPromise.TriggerPromiseReactions(reactions!, reason);
  }
  private static FulfillPromise<T>(promise: MyPromise<T>, value: T) {
    if (promise.PromiseState !== PENDING) throw new Error('The promise state is not PENDING');
    const reactions = promise.PromiseFulfillReactions;
    promise.PromiseResult = value;
    promise.PromiseFulfillReactions = void 0;
    promise.PromiseRejectReactions = void 0;
    promise.PromiseState = FULFILLED;
    MyPromise.TriggerPromiseReactions(reactions!, value);
  }
  private static TriggerPromiseReactions(reactions: Function[], arg: unknown) {
    reactions.forEach((reaction) => runMicroTask(reaction.bind(globalThis, arg)));
  }
  private _RunPromiseHandler<K>(
    handler: (value: T | any) => K,
    value: T | any,
    nextPromiseCapability: MyPromiseWithResolvers<K>
  ) {
    try {
      const result = handler(value);
      nextPromiseCapability.resolve(result);
    } catch (e) {
      nextPromiseCapability.reject(e);
    }
  }
  then<K>(onFulfilled?: (value: T) => K, onRejected?: (reason: any) => void) {
    if (!IsPromise(this)) throw new TypeError('this is not a promise');
    if (!IsPromise(onFulfilled)) onFulfilled = void 0;
    if (!IsPromise(onRejected)) onRejected = void 0;

    const ResultCapability = MyPromise.withResolvers<K>();

    const fulfillReaction = (value: T) => {
      if (onFulfilled) this._RunPromiseHandler(onFulfilled, value, ResultCapability);
    };
    const rejectReaction = (reason: any) => {
      // @ts-expect-error 2345
      if (onRejected) this._RunPromiseHandler(onRejected, reason, ResultCapability);
      else ResultCapability.reject(reason);
    };

    if (this.PromiseState === PENDING) {
      this.PromiseFulfillReactions!.push(fulfillReaction);
      this.PromiseRejectReactions!.push(rejectReaction);
    } else if (this.PromiseState === FULFILLED) {
      const value = this.PromiseResult;
      runMicroTask(() => {
        fulfillReaction(value);
      });
    } else {
      if (this.PromiseState !== REJECTED)
        throw new Error('The promise state is one of FULFILLED, REJECTED or PENDING');
      const reason = this.PromiseResult;
      if (!this.PromiseIsHandled) {
        __HostPromiseRejectionTracker(this, 'handle');
      }
      runMicroTask(() => {
        rejectReaction(reason);
      });
    }
    this.PromiseIsHandled = true;
    return ResultCapability.promise;
  }
  static withResolvers<K>() {
    let resolve: (value: K) => void;
    let reject: (reason: any) => void;
    const promise = new MyPromise<K>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // @ts-expect-error 2454
    return { promise, resolve, reject } as MyPromiseWithResolvers<K>;
  }
  static resolve<T>(value: T): T extends PromiseObject<T> ? T : MyPromise<T> {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    // @ts-expect-error 2322
    if (IsPromise(value)) return value;
    const ResultCapability = MyPromise.withResolvers<T>();
    ResultCapability.resolve(value);
    // @ts-expect-error 2322
    return ResultCapability.promise;
  }
  static reject<T>(reason: any) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<T>();
    ResultCapability.reject(reason);
    return ResultCapability.promise;
  }
  static all<T>(promises: (PromiseLike<T> | T)[]) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<T[]>();
    const values: T[] = [];
    let remainingElementsCount = 0;
    let index = 0;
    for (const i of promises) {
      const nowIndex = index++;
      const t = MyPromise.resolve(i);
      // @ts-expect-error 2349
      t.then(
        (value: T) => {
          values[nowIndex] = value;
          remainingElementsCount--;
          if (remainingElementsCount === 0) {
            ResultCapability.resolve(values);
          }
        },
        (reason: any) => {
          ResultCapability.reject(reason);
        }
      );
    }
    if (remainingElementsCount === 0) {
      ResultCapability.resolve(values);
    }
    return ResultCapability.promise;
  }
  static race<T>(promises: (PromiseLike<T> | T)[]) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<T>();
    for (const i of promises) {
      const t = MyPromise.resolve(i);
      // @ts-expect-error 2349
      t.then(
        (value: T) => {
          ResultCapability.resolve(value);
        },
        (reason: any) => {
          ResultCapability.reject(reason);
        }
      );
    }

    return ResultCapability.promise;
  }
  static allSettled<T>(promises: (PromiseLike<T> | T)[]) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<PromiseSettledResult<T>[]>();
    const values: PromiseSettledResult<T>[] = [];
    let remainingElementsCount = 0;
    let index = 0;
    for (const i of promises) {
      const nowIndex = index++;
      const t = MyPromise.resolve(i);
      // @ts-expect-error 2349
      t.then(
        (value: T) => {
          values[nowIndex] = {
            status: 'fulfilled',
            value,
          };
          remainingElementsCount--;
          if (remainingElementsCount === 0) {
            ResultCapability.resolve(values);
          }
        },
        (reason: any) => {
          values[nowIndex] = {
            status: 'rejected',
            reason,
          };
          remainingElementsCount--;
          if (remainingElementsCount === 0) {
            ResultCapability.resolve(values);
          }
        }
      );
    }
    if (remainingElementsCount === 0) {
      ResultCapability.resolve(values);
    }
    return ResultCapability.promise;
  }
  static any<T>(promises: (PromiseLike<T> | T)[]) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<T>();
    const errors: any[] = [];
    let remainingElementsCount = 0;
    let index = 0;
    for (const i of promises) {
      const nowIndex = index++;
      const t = MyPromise.resolve(i);
      // @ts-expect-error 2349
      t.then(
        (value: T) => {
          ResultCapability.resolve(value);
        },
        (reason: any) => {
          errors[nowIndex] = reason;
          remainingElementsCount--;
          if (remainingElementsCount === 0) {
            ResultCapability.reject(new AggregateError(errors));
          }
        }
      );
    }
    if (remainingElementsCount === 0) {
      ResultCapability.reject(new AggregateError(errors));
    }
    return ResultCapability.promise;
  }
  static try<T extends any[], R>(func: (...args: T) => R, ...args: T) {
    if (!IsObject(this)) throw new TypeError('this is not a object');
    const ResultCapability = MyPromise.withResolvers<R>();
    try {
      ResultCapability.resolve(func(...args));
    } catch (error) {
      ResultCapability.reject(error);
    }
    return ResultCapability.promise;
  }
  catch<K>(onRejected?: (reason: any) => K) {
    if (!IsPromise(this)) throw new TypeError('this is not a promise');
    return this.then(void 0, onRejected);
  }
  finally(onFinally?: () => void) {
    if (!IsPromise(this)) throw new TypeError('this is not a promise');
    return this.then(onFinally, onFinally);
  }
}
