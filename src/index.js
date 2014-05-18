newtype Thunk {
	thunk: *
}

function force {
	Thunk(a @ Function) => a()
}

data Stream {
	Nil,
	Cons {
		head: *,
		tail: Thunk
	}
};

operator $ 4 {$x} => #{ Thunk(function() { return $x }) }
operator (::) 5 right {$l, $r} => #{Cons($l, $ $r)}

function foldr(k, z, s) {
	function go {
		Nil => z,
		Cons(a, s) => k(a, go(force(s)))
	}

	return go(s);
}

var mkString = λ a -> foldr(function(a, s) {
	return a + s
}, "", a);

function foldr1 {
	(f, Cons(a, s)) => foldr1nonempty(a)(f)(force(s))
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

function take {
	(0, *) => Nil,
	(n, Nil) => Nil,
	(n, Cons(a, s)) => a :: take(n-1, force(s))
}

function drop {
	(0, a) => a,
	(n, Nil) => Nil,
	(n, Cons(a, s)) => drop(n-1, force(s))
}

function takeStr {
	(0, *) => Nil,
	(n, Nil) => Nil,
	(n, Cons(a @ String, s)) if a.length < n => a :: takeStr(n-a.length, force(s)),
	(n, Cons(a @ String, s)) if a.length >= n => a.slice(0, n) :: Nil
}

function dropStr {
	(0, a) => a,
	(n, Nil) => Nil,
	(n, Cons(a @ String, s)) if a.length < n => dropStr(n-a.length, force(s)),
	(n, Cons(a @ String, s)) if a.length >= n => a.slice(n) :: force(s)
}

function of(a) {
	return a :: Nil;
}

function concat {
	(Nil, b) => b,
	(Cons(a,s), b) => a :: concat(force(s), b)
}

function flatMap {
	(f, Cons(a, s)) => concat(f(a), flatMap(f, force(s))),
	(*, Nil) => Nil
}

var map = λ f a -> flatMap((λ a -> of(f(a))), a)

var ap = λ s a ->
	flatMap(
		λ f -> map(f)(a),
		s
	)

var head = λ s -> take(1, s)
var tail = λ s -> drop(1, s)

function toCharStream(s) {
	return flatMap(
		λ c -> fromString(c),
		s
	)
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
	toString: mkString
};

for(var m in methods) {
	Stream.prototype[m] = function {
		(...args) => methods[m].apply(this, [this].concat(args))
	}
}

