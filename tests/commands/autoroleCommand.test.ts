import { PermissionFlagsBits } from 'discord.js';
import { autoroleCommand } from '../../src/commands/autorole/autorole';
import { handleConfig, handleLinks } from '../../src/commands/autorole/autoroleHandlers';
import { AutoroleService } from '../../src/services/autorole';
import { ServerConfigManager } from '../../src/utils/serverConfigManager';

describe('/autorole links link', () => {
  it('registers the additive Prestige role setting', () => {
    const command = autoroleCommand.data.toJSON();
    const config = command.options?.find(option => option.name === 'config');
    const set = config && 'options' in config ? config.options?.find(option => option.name === 'set') : undefined;
    expect(set && 'options' in set ? set.options?.map(option => option.name) : []).toEqual(
      expect.arrayContaining(['prestige_role', 'clear_prestige_role'])
    );
  });

  it('saves the chosen Prestige role without changing the level-role ladder', async () => {
    const update = jest.spyOn(ServerConfigManager, 'updateAutoroleConfig').mockImplementation(() => undefined);
    const interaction = {
      guild: { id: 'server-1' },
      user: { id: 'staff-1' },
      memberPermissions: { has: jest.fn().mockReturnValue(true) },
      options: {
        getSubcommand: () => 'set',
        getRole: (name: string) => name === 'prestige_role' ? { id: 'prestige' } : null,
        getBoolean: () => null,
        getInteger: () => null,
        getNumber: () => null,
        getString: () => null,
        getChannel: () => null,
      },
      reply: jest.fn().mockResolvedValue(undefined),
    };
    try {
      await handleConfig(interaction as never, {} as never);
      expect(update).toHaveBeenCalledWith('server-1', { prestigeRoleId: 'prestige' });
    } finally {
      update.mockRestore();
    }
  });

  it('is registered under the Manage Roles-gated autorole command', () => {
    const command = autoroleCommand.data.toJSON();
    expect(command.default_member_permissions).toBe(PermissionFlagsBits.ManageRoles.toString());

    const links = command.options?.find(option => option.name === 'links');
    const link = links && 'options' in links ? links.options?.find(option => option.name === 'link') : undefined;
    expect(link).toMatchObject({
      name: 'link',
      options: [
        expect.objectContaining({ name: 'user', required: true }),
        expect.objectContaining({ name: 'account', required: true }),
      ],
    });
  });

  it('also rejects manual linking at runtime without Manage Roles', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const manualLink = jest.fn();
    const interaction = {
      guild: { id: 'server-1' },
      user: { id: 'staff-1', tag: 'Staffer' },
      memberPermissions: { has: jest.fn().mockReturnValue(false) },
      options: {
        getSubcommand: jest.fn().mockReturnValue('link'),
        getUser: jest.fn().mockReturnValue({ id: 'member-1' }),
      },
      deferred: false,
      replied: false,
      reply,
    };
    const service = {
      getStore: jest.fn().mockReturnValue({}),
      getLinkFlow: jest.fn().mockReturnValue({ manualLink }),
    } as unknown as AutoroleService;

    await handleLinks(interaction as never, service);

    expect(reply).toHaveBeenCalledWith({
      content: 'You need the Manage Roles permission to manually link an account.',
      ephemeral: true,
    });
    expect(manualLink).not.toHaveBeenCalled();
  });
});
