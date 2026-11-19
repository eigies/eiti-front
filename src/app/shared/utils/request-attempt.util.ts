/**
 * Id de intento para un alta. Viaja en el pedido para que el back no cree dos ventas si el mismo pedido le
 * llega dos veces: Chrome reenvia un POST por su cuenta cuando la conexion se traba, y el servidor recibe los
 * dos (MAT-4194 y MAT-4195, 2026-11-19).
 *
 * Si despues de un error el usuario reintenta exactamente lo mismo, se reusa el id: si la primera vez la venta
 * llego a crearse, el back devuelve esa. Cualquier cambio es otro intento y lleva id nuevo; si no, empezar
 * otra venta despues de un error de red podria devolver la anterior en vez de crear la nueva.
 */
export class RequestAttempt {
    private last: { readonly id: string; readonly body: string } | null = null;

    /** Id para este pedido (sin el id): el mismo mientras el pedido no cambie ni se complete. */
    idFor(body: unknown): string {
        const serialized = JSON.stringify(body);
        if (this.last?.body !== serialized) {
            this.last = { id: crypto.randomUUID(), body: serialized };
        }
        return this.last.id;
    }

    /** El alta quedo hecha: el proximo pedido, aunque sea igual, es otra venta. */
    complete(): void {
        this.last = null;
    }
}
