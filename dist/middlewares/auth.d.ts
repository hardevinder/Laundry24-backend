export type AuthUser = {
    id: number;
    email: string;
    isAdmin?: boolean;
};
declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: AuthUser;
        user: AuthUser;
    }
}
declare const _default: (fastify: import("fastify").FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>) => Promise<void>;
export default _default;
//# sourceMappingURL=auth.d.ts.map