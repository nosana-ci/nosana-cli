# Logging (How are logs tracked? )

Logging Proxy (`loggingProxy.ts`)

Logging in the Node is Unique as it is abstracted from the main logic and is implemented using a proxy, this lets our code look clean and move all the logger calls to a fringe part of our code.

We log using a `loggingProxy` this proxy are a set of lets say function middleware that intercept the inputs state and output of a function. then this detail is sent via a log emitter `EventEmitter` (built in JS event) this emitter will be listened to by other processes and used.

there are three ways we can use the this functionality in our node system.

- `createLoggingProxy` : this can take a class and all functions activity within the class would be broadcasted to the event emitter.
    
    ```tsx
    class MyClass {
    	constructor(options){
    	}
    	
    	myFunction(){
    		...doSomething
    	}
    }
    
    const myClass = createLoggingProxy(new MyClass(options));
    myClass.myFunction()
    
    /**
    * a data like this is sent to the EventEmitter when the function is called
    *
    {
      class: MyClass,
      method: myFunction,
      arguments: [],
      timestamp: 1313123242343454,
      type: 'call',
      result?: null,
      error?: null
    }
    /
    
    ```
    
- `applyLoggingProxyToClass`: this is called in the constructor of a class and it uses the same `createLoggingProxy`  logic to dynamically log function calls/error/result of all classes this class has as parameter and that has been registered in it properties.
    
    ```tsx
    class MyClass {
    	private myClass2: MyClass2;
      
    	constructor(options){
    		applyLoggingProxyToClass(this)
    	}
    	
    	myFunction(){
    		myClass2.doSomething(20)
    	}
    }
    
    const myClass = new MyClass(options);
    myClass.myFunction()
    
    //NT: the myClass2 needs to be added to registed properties in the applyLoggingProxyToClass
    
    /**
    * a data like this is sent to the EventEmitter when the function is called
    *
    {
      class: MyClass2,
      method: doSomething,
      arguments: [20],
      timestamp: 1313123242343454,
      type: 'call',
      result?: null,
      error?: null
    }
    /
    
    ```
    
- `createFunctionLoggingProxy`: this is called and wrapped around a function then the function is subscribe to send it’s info to the `EventEmitter`
    
    ```tsx
    
    function add(a: number, b: number): number {
      return a + b;
    }
    
    const proxiedAdd = createFunctionLoggingProxy(add, 'AddClass');
    // or
    // const proxiedAdd = createFunctionLoggingProxy(add);
    
    /**
    * a data like this is sent to the EventEmitter when the function is called
    *
    {
      class: AddClass,
      method: add,
      arguments: [20],
      timestamp: 1313123242343454,
      type: 'call',
      result?: null,
      error?: null
    }
    /
    
    ```
    

As of now there are two subscribers to the Log `EventEmitter` , they are the `NodeLog` and `NodeState` 

[NodeLog](Logging%20(How%20are%20logs%20tracked%20)%2014ba27e6386580f29314d9988ccfecd3/NodeLog%2014ba27e6386580f2a178e5ec06bb9e41.md)

[NodeState](Logging%20(How%20are%20logs%20tracked%20)%2014ba27e6386580f29314d9988ccfecd3/NodeState%2014ba27e6386580e0970ae88ddf58bba8.md)