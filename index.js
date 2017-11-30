function compose(...funcs) {
    if (funcs.length === 0) {
        return arg => arg
    }

    if (funcs.length === 1) {
        return funcs[0]
    }

    const last = funcs[funcs.length - 1]
    const rest = funcs.slice(0, -1)

    console.log('last', last, 'rest', rest);

    return (...args) => {
        console.log('args', args);
        return rest.reduceRight((composed, f) => f(composed), last(...args))
    }
}

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
