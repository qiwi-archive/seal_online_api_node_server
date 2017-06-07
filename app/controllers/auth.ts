import {Context} from 'koa';
import {Controller, InnoError} from 'innots';
import * as ent from 'ent';
import {JwtService} from "../services/jwt";
import {LdapService} from "../services/ldap";

export class AuthController extends Controller {
    login = async(ctx: Context, next: Function): Promise<void> => {
        const data = this.validate(ctx, (validator) => {
            return {
                login: validator.isString('login'),
                password: ent.decode(validator.isString('password'))
            };
        });

        const authResult = await LdapService.authAndCheckCategory(data.login, data.password);

        if (!authResult) {
            throw new InnoError('LDAP_LOGIN_FAILED', 400, {});
        }

        ctx.body = JwtService.getToken({login: data.login});
        next();
    };
}