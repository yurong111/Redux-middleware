# Redux-middleware

##中间件来由
- 什么是中间件？
中间件就是在程序的action->reducer时，中间拦截，处理一堆自定义的事情action->middleware->reducer。
- 为什么要有中间件的存在？
其实以往处理这种情况，都是手动去处理。如下日志打印：
```
console.log('start');
dispatch(action);
console.log('end');
```
以上就相当于中间件想要做的事情，但是中间件不是以这种形式而存在的。因为手动处理，每个地方需要打印日志的话，就每个地方都需要编写这段类似的代码。重复性的操作过多，而中间件就是为了解决类似问题而存在的。只要是action->reducer这个路径，一处编写，多处使用。

##中间件的原理
[原理剖析很棒](http://cn.redux.js.org/docs/advanced/Middleware.html)
因为redux是通过dispatch发起一个修改state动作的，但是每个动作的触发又要都经过一系列的中间件。那怎么做到action->middleware1->middleware2->...->reducer？
主要是在middleware设置在store中时，将所有中间件中的dispatch包装成下一个中间件的返回的函数，实际使用名为next，而不是dispatch，该函数可以是该中间件要做的事情，而最后一个中间件才是真正触发store.dispatch。所以每个中间件中next(action)，实际就是在调用下一个中间件的方法。类似于a(b(c()))；所以中间件数组是有顺序可言的。
所以在中间件的执行过程，大致是这样的：

![中间件的执行过程](http://upload-images.jianshu.io/upload_images/5499785-0a3c1cb81d4d7f79.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


然后对于为什么next()是什么时候怎样被设置成了下一个中间件返回的函数呢？
在创建store时，有以下配置：
```
const middleware = [logger, apiMiddlewares];
import toduReducer from '../store/reducer.jsx';

const store = createStore(toduReducer, applyMiddleware(logger, crashReporter));
```
所以所有中间件事前准备都在applyMiddleware以及compose完成了。
先来看看中间件三层结构由来？
```
const middleware1 = store => next => action => {
   //省略
};
export default middleware1;
```
为什么会有这么多参数，那就得追溯源码了：
```
//applyMiddleware.js源码
export default function applyMiddleware(...middlewares) {
    return (createStore) => (reducer, initialState, enhancer) => {
        var store = createStore(reducer, initialState, enhancer)
        var dispatch = store.dispatch
        var chain = []
        var middlewareAPI = {
            getState: store.getState,
            dispatch: (action) => dispatch(action)
        }
        chain = middlewares.map(middleware => middleware(middlewareAPI))
        dispatch = compose(...chain)(store.dispatch)
        return {
            ...store,
            dispatch
        }
    }
}
```
- 以上middlewares参数，是在配置createStore时传进来的中间件数组；
- 而middlewares.map(middleware => middleware(middlewareAPI))循环调用中间件，传入第一层参数middlewareAPI。另外middlewareAPI是可以传入整个store，然后并没有，只是传了两个变量而已。
- 上面执行过程讲了，只有在最后一个中间件调用了store.dispatch，其余调的都是下一个中间件。而compose(...chain)暂理解成是a(b(c()))，其返回了一个函数，而store.dispatch是返回函数的参数，也是第二层参数，c中的接收的next是外部传入来的参数store.dispath，其余的next都是下一个中间件的返回函数，例如，a的next参数是b的返回，b的next参数是c的返回。这样就达到了中间件串联的效果。
- applyMiddleware封装了两层，所以最后在使用的时候调用dipatch(action)，这个action就是第三个参数。

```
//compose源码
export default function compose(...funcs) {
    if (funcs.length === 0) {
        return arg => arg
    }

    if (funcs.length === 1) {
        return funcs[0]
    }

    const last = funcs[funcs.length - 1]
    const rest = funcs.slice(0, -1)
    return (...args) => rest.reduceRight((composed, f) => f(composed), last(...args))
}
```

## 模拟中间件
为了便于自己理解，模拟compose方法的调用，以及打印compose的相关信息：
```
function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  const last = funcs[funcs.length - 1]
  const rest = funcs.slice(0, -1)

  console.log('last:', last, 'rest:', rest);

  return (...args) => {
    console.log('args:', args);
    return rest.reduceRight((composed, f) => f(composed), last(...args))
  }
}
```
调用：
```
var fun1 = () =>{return ()=>{console.log('111')}};
var fun2 = () =>{return ()=>{console.log('222')}};
var fun3 = () =>{return ()=>{console.log('333')}};

var chain = [fun1, fun2, fun3];
//var dispatch = compose(...chain)(store.dispatch); //源码分析
var dispatch = compose(...chain)(1);
console.log('dispatch:', dispatch);
dispatch();
```

打印结果：
```
last: fun3() {}
rest: [fun1(){}, fun2(){}]
args: [1]
fun3
fun2
fun1
dispatch: fun1(){}
111
```
最后的dispatch返回的是第一个的中间件函数，所以当用户触发dispatch(action)的时候，实际触发的是第一个中间件，但是这里的模拟中间件，只是返回一个包括打印信息的函数，如果要想中间件串联执行下去，那么第一个中间件必须包含下一个中间件的执行方法。继续改写中间件：

```
var fun1 = (next) =>{
  return ()=>{
    next();
    console.log('111')
  }
};

var fun2 = (next) =>{
  return ()=>{
    next();
    console.log('222')
  }
};

var fun3 = (next) =>{
  return ()=>{
    if (typeof next === 'function') {
      next();
    }else {
      console.log('最后调用');
    }

    console.log('333')
  }
};

var chain = [fun1, fun2, fun3];
//源码分析
var dispatch = compose(...chain)(1);
console.log('dispatch', dispatch);
dispatch();
```
打印结果：
```
last: fun3() {}
rest: [fun1(){}, fun2(){}]
args: [1]
dispatch: fun1(){}
最后调用
333
222
111
```
为什么会有next参数，忘记了吗？reduceRight函数已经帮我们做了这件事情，将下一个中间件返回的函数当做参数传给中间件。

从上面可以看到中间件只有两层，而内嵌函数的入参应该是dispatch(action)中的action。
```
var fun1 = (next) =>{
  return (action)=>{
    next(action);
    console.log('111', action)
  }
};

var fun2 = (next) =>{
  return (action)=>{
    next(action);
    console.log('222', action)
  }
};

var fun3 = (next) =>{
  return (action)=>{
    if (typeof next === 'function') {
      next(action);
    }else {
      console.log('最后调用');
    }

    console.log('333', action)
  }
};

var chain = [fun1, fun2, fun3];
//源码分析
var dispatch = compose(...chain)(1);
console.log('dispatch', dispatch);
dispatch('action');
```
打印结果：
```
last: fun3() {}
rest: [fun1(){}, fun2(){}]
args: [1]
dispatch: fun1(){}
最后调用
333 action
222 action
111 action
```
而所谓的三层结构呢？在applyMiddleware源码中循环调用中间件时传了store的两个变量进去，这就是第一层。所以中间件的三层结构就是这么来的。

##如何编写中间件
- 三层结构；
记得返回next供下一个中间件使用，即返回一个函数作为next供下一个中间件使用。
- createstore中引入;
```
const middleware = [apiMiddlewares];
import toduReducer from '../store/reducer.jsx';
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;    /*redux在浏览器查看*/

const store = createStore(toduReducer, /* preloadedState, */ composeEnhancers(
    applyMiddleware(...middleware)  /*中间件，处理接口异步调用*/
));
```
OK!