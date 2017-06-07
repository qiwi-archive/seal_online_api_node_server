import * as config from 'config';
import * as ActiveDirectory from 'activedirectory';

export class LdapService {
    static async authAndCheckCategory(username: string, password: string): Promise<boolean> {
        username = username + config.get<string>('activeDirectory.userPostfix');

        const ad = new ActiveDirectory(Object.assign(
            {},
            config.get<any>('activeDirectory.instanceConfig'),
            {
                username,
                password
            }
        ));

        if (config.has('activeDirectory.allowedGroup')) {
            return new Promise<boolean>((resolve, reject) => {
                ad.isUserMemberOf(
                    username,
                    config.get<string>('activeDirectory.allowedGroup'),
                    function (err: any, result: any): void {
                        if (err || !result) {
                            resolve(false);
                        }
                        resolve(true);
                    });
            });
        }

        return new Promise<boolean>((resolve, reject) => {
            ad.authenticate(username, password, function (err: any, result: any): void {
                if (err || !result) {
                    resolve(false);
                }
                resolve(true);
            });
        });
    }
}