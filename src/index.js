var Extractor = require('adt-simple').Extractor;

function γ(f){
	return (function _curry(args) {
		return function(){
			var params = args ? args.concat() : [];
			return params.push.apply(params, arguments) <
					f.length && arguments.length ?
				_curry.call(this, params) : f.apply(this, params);
		};
	}());
}

var flip = γ(λ(f, a, b) -> f(b, a));

data Thunk {
	thunk: *
} deriving Extractor

function force {
	Thunk(a @ Function) => a()
}

/* @overrideapply */
union Stream {
	Nil,
	Cons {
		head: *,
		tail: * // Thunk
	}
} deriving Extractor

function equals {
	(Nil, Nil)  => true,
	(Nil, Cons) => false,
	(Cons, Nil) => false,
	(Cons(a, s), Cons(b, t)) => a === b && equals(force(s), force(t))
}

operator $ 4 {$x} => #{ Thunk(function() { return $x }) }
operator (::) 5 right {$l, $r} => #{Cons($l, $ $r)}

function foldr(s, k, z) {
	function go {
		Nil => z,
		Cons(a, s) => k(a, go(force(s)))
	}

	return go(s);
}

var mkString = λ a -> foldr(a, function(a, s) {
	return a + s
}, "");

function foldr1 {
	(Cons(a, s), f) => foldr1nonempty(a)(f)(force(s))
}

var foldr1nonempty = λ a f -> function {
	Nil => a,
	r @ Cons => f(a, foldr1(f, r))
}

function fromList {
	[] => Nil,
	[head, ...tail] => head :: fromList(tail)
}

function fromString {
	s @ String => fromList([].slice.call(s))
}

function pipe {
	(Cons(a, s), dest) => dest.write(a); pipe(force(s), dest),
	(Nil, dest) => dest.end()
}

var take = γ(function take {
	(0, *) => Nil,
	(n, Nil) => Nil,
	(n, Cons(a, s)) => a :: take(n-1, force(s))
});

var drop = γ(function drop {
	(0, a) => a,
	(n, Nil) => Nil,
	(n, Cons(a, s)) => drop(n-1, force(s))
});

var takeStr = γ(function takeStr {
	(0, *) => Nil,
	(n, Nil) => Nil,
	(n, Cons(a @ String, s)) if a.length < n => a :: takeStr(n-a.length, force(s)),
	(n, Cons(a @ String, s)) if a.length >= n => a.slice(0, n) :: Nil
});

var dropStr = γ(function dropStr {
	(0, a) => a,
	(n, Nil) => Nil,
	(n, Cons(a @ String, s)) if a.length < n => dropStr(n-a.length, force(s)),
	(n, Cons(a @ String, s)) if a.length >= n => a.slice(n) :: force(s)
});

function of(a) {
	return a :: Nil;
}

function empty() {
	return Nil;
}

function concat {
	(Nil, b) => b,
	(Cons(a,s), b) => a :: concat(force(s), b)
}

function flatMap {
	(Cons(a, s), f) => concat(f(a), flatMap(force(s), f)),
	(Nil) => Nil
}

var map = γ(λ(s, f) -> flatMap(s, λ a -> of(f(a))));
var ap  = γ(λ(s, a) -> flatMap(s, λ f -> map(a,f)));

var head = take(1);
var tail = drop(1);

function toCharStream(s) {
	return flatMap(
		λ c -> fromString(c),
		s
	);
}

function group(n, s) {
	return mkString(take(n, s)) :: group(drop(n, s))
}

function lengthCompare {
	("", Nil)  => 0,  // same length
	(*,  Nil)  => 1,  // string is longer
	("", Cons) => -1, // stream is longer
	(x @ String, Cons(a,s)) => lengthCompare(x.slice(1), force(s))
}

var repeat = λ x -> x :: repeat(x)
var replicate = λ(n,x) -> take(n, repeat(x))

function zip {
	(Nil, Nil)  => Nil,
	(Cons, Nil) => Nil,
	(Nil, Cons) => Nil,
	(Cons(x, xs), Cons(y, ys)) => [x,y] :: zip(force(xs), force(ys))
}

var iterate = λ i -> i :: iterate(i+1)
var zipWithIndex = λ stream -> zip(iterate(0), stream)

// sequence :: Stream M a → M Stream a
var sequence = λ M s -> foldr(
	λ(m1, m2) -> {
		return m1.chain(λ x -> {
			return m2.chain(λ xs -> {
				return M.of(Cons(x, $ xs))
			})
		})
	},
	M.of(Nil),
	s
);

var methods = {
	chain: flatMap,
	map: map,
	ap: ap,
	concat: concat,
	mkString: mkString,
	empty: empty,
	take: flip(take),
	drop: flip(drop),
	isEqual: equals,
	equals: equals,
	eq: equals
};

for(var m in methods) { (function(m) {
	Stream.prototype[m] = function {
		(...args) => methods[m].apply(this, [this].concat(args))
	}} (m));
}

Stream.prototype.of = of;
Stream.of = of;
Stream.empty = empty;

Stream.fromString = fromString;
Stream.fromList = fromList;

function apply {
	x @ String => fromString(x),
	x @ Array  => fromList(x),
	x => of(x)
};

Stream.apply = function(ctx, args) {
	return apply.apply(ctx, args);
}

module.exports = Stream;
