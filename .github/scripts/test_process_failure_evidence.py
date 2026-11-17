"""Mandatory full process-evidence conformance; no protocol selection or discovery."""
from pathlib import Path
import sys
from evidence_artifacts import prepared, run_cli
from process_failure_fixture import EvidenceCase
import test_process_failure_pg_evidence as pg
import test_process_failure_go_evidence as go


def main():
    parser = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('verify_api_process_failure.py')
    context = EvidenceCase(parser)
    context.positive(context.files, 'baseline')
    pg.run(context)
    go.run(context)
    with prepared(context.files) as base:
        result = run_cli([sys.executable, str(parser.resolve())], base)
        assert result.returncode == 0, result.stderr
    context.positives.append('parser CLI')
    context.inventory(0, 181, '220d25ae5b9dcd16345e7006a24a47f8b7e4478eae8c344c28ae82dae6b67853')
    assert context.positives == ['baseline', 'delayed disconnect 1100', 'delayed disconnect 1104',
                                 'optional archive directory', 'timezone identity', 'fragmented Go output', 'parser CLI']
    context.finish()
    print('Verified 181 negative controls and seven distinct positive scenarios (synthetic only)')


if __name__ == '__main__':
    main()
