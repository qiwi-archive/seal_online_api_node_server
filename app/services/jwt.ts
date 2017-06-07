import * as jsonWebToken from 'jsonwebtoken';
import * as config from 'config';

export class JwtService {
    static getToken(payload: any): string {
        return jsonWebToken.sign({login: payload.login}, config.get<string>('jwt.secret'));
    }
}