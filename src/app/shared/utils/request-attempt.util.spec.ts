import { RequestAttempt } from './request-attempt.util';

describe('RequestAttempt', () => {
    const sale = { branchId: 'b1', details: [{ productId: 'p1', quantity: 1 }] };

    it('reuses the id while the same request is retried', () => {
        const attempt = new RequestAttempt();

        const first = attempt.idFor(sale);
        const retry = attempt.idFor({ ...sale, details: [{ productId: 'p1', quantity: 1 }] });

        expect(retry).toBe(first);
    });

    it('gives a new id when the request changes', () => {
        const attempt = new RequestAttempt();

        const first = attempt.idFor(sale);
        const changed = attempt.idFor({ ...sale, details: [{ productId: 'p1', quantity: 2 }] });

        expect(changed).not.toBe(first);
    });

    it('gives a new id for the next sale once the previous one was created', () => {
        const attempt = new RequestAttempt();

        const first = attempt.idFor(sale);
        attempt.complete();

        expect(attempt.idFor(sale)).not.toBe(first);
    });
});
