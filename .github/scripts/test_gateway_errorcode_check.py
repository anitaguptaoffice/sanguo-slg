import json
import unittest
from gateway_errorcode_check import BINDINGS, CANONICAL, check


class EvidenceTests(unittest.TestCase):
    def events(self, result='pass'):
        return [{'Action': 'start', 'Package': BINDINGS},
                {'Action': 'run', 'Package': BINDINGS, 'Test': CANONICAL},
                {'Action': 'output', 'Package': BINDINGS, 'Test': CANONICAL,
                 'Output': 'canonical/generated cardinality: source=55 descriptor=36 names=36 values=36'},
                {'Action': result, 'Package': BINDINGS, 'Test': CANONICAL},
                {'Action': result, 'Package': BINDINGS}]

    def validate(self, events, baseline=False):
        return check('\n'.join(map(json.dumps, events)), {(BINDINGS, CANONICAL)}, baseline)

    def test_valid(self):
        self.validate(self.events())
        self.validate(self.events('fail'), True)

    def test_reject_bad_evidence(self):
        original = self.events()
        variants = [[], original[:-1], original[:3] + original[4:],
                    original[:2] + original[1:], self.events('skip'), self.events('fail'),
                    original + [original[-1]], original[:4] + [original[3]] + original[4:]]
        for field, value in [('Package', 'wrong'), ('Test', 'Missing'), ('Action', 'mystery'), ('Action', 'pause'), ('Action', 'cont')]:
            events = self.events()
            events[1][field] = value
            variants.append(events)
        for action in ('pause', 'cont'):
            late = dict(original[1], Action=action)
            variants.append(original[:4] + [late] + original[4:])
        for events in variants:
            with self.subTest(events=events), self.assertRaises(AssertionError):
                self.validate(events)
        with self.assertRaises(json.JSONDecodeError):
            check('not json', {(BINDINGS, CANONICAL)})

    def test_baseline_requires_named_cardinality_failure(self):
        for text in ['compile failed', 'source=55 descriptor=55 names=55 values=55']:
            events = self.events('fail')
            events[2]['Output'] = text
            with self.assertRaises(AssertionError):
                self.validate(events, True)
        with self.assertRaises(AssertionError):
            self.validate(self.events(), True)


if __name__ == '__main__':
    unittest.main()
