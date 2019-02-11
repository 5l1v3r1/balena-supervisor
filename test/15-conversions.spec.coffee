m = require 'mochainon'
{ expect } = m.chai

conversion = require '../src/lib/conversions'

describe 'conversions', ->

	describe 'envArrayToObject', ->
		it 'should convert an env array to an object', ->
			expect(conversion.envArrayToObject([
				'key=value'
				'test1=test2'
				'k=v'
				'equalsvalue=thisvaluehasan=char'
				'asd='
				'number=123'
			])).to.deep.equal({
				key: 'value'
				test1: 'test2'
				k: 'v'
				equalsvalue: 'thisvaluehasan=char'
				asd: ''
				number: '123'
			})

		it 'should ignore invalid env array entries', ->
			expect(conversion.envArrayToObject([
				'key1',
				'key1=value1'
			])).to.deep.equal({
				key1: 'value1'
			})

		it 'should return an empty object with an empty input', ->
			expect(conversion.envArrayToObject(null)).to.deep.equal({})
			expect(conversion.envArrayToObject('')).to.deep.equal({})
			expect(conversion.envArrayToObject([])).to.deep.equal({})
			expect(conversion.envArrayToObject(1)).to.deep.equal({})

	it 'should correctly handle whitespace', ->
		expect(conversion.envArrayToObject([
			'key1= test',
			'key2=test\ntest',
			'key3=test ',
			'key4= test '
		])).to.deep.equal({
			key1: ' test',
			key2: 'test\ntest',
			key3: 'test ',
			key4: ' test ',
		})
