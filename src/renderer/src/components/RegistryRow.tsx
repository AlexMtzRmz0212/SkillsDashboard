import { installCommand, type RegistryHit } from '@shared/types'
import type { InstallerApi } from '../useInstaller'
import { Icon } from './Icon'
import { formatInstalls } from './Installs'

/** The Install / Reinstall button, which also shows progress while this skill installs. */
export function InstallButton({
  hit,
  installer,
  installed
}: {
  hit: RegistryHit
  installer: InstallerApi
  installed: boolean
}): React.JSX.Element {
  const isActive = installer.active?.id === hit.id
  return (
    <button
      className={`btn small ${installed ? '' : 'primary'}`}
      disabled={installer.active !== null}
      onClick={() => installer.install(hit)}
      title={installCommand(hit.source, hit.skillId, installer.withClaude)}
    >
      {isActive ? (
        <>
          <span className="spin">
            <Icon name="refresh" size={14} />
          </span>
          Installing…
        </>
      ) : (
        <>
          <Icon name="download" size={14} />
          {installed ? 'Reinstall' : 'Install'}
        </>
      )}
    </button>
  )
}

interface Props {
  hit: RegistryHit
  installer: InstallerApi
  installed: boolean
  /** Open this skill's page. */
  onOpen(): void
  /** Open the repo this skill is from; leave out when already inside that repo. */
  onOpenRepo?(): void
}

/** One skill from skills.sh: name, repo, installs and the Install button. */
export function RegistryRow({ hit, installer, installed, onOpen, onOpenRepo }: Props): React.JSX.Element {
  return (
    <div className="hit">
      <div className="hit-main">
        <div className="row-top">
          <button className="hit-name" onClick={onOpen}>
            {hit.name}
          </button>
          {installed && (
            <span className="tag tag-ok">
              <Icon name="check" size={11} />
              Installed
            </span>
          )}
        </div>
        <div className="hit-sub">
          {onOpenRepo && (
            <button className="link-btn hit-repo" onClick={onOpenRepo} title={`Browse ${hit.source}`}>
              {hit.source}
            </button>
          )}
          {hit.installs > 0 && (
            <span className="installs" title={`${hit.installs.toLocaleString()} installs on skills.sh`}>
              <Icon name="download" size={11} />
              {formatInstalls(hit.installs)}
            </span>
          )}
        </div>
      </div>
      <InstallButton hit={hit} installer={installer} installed={installed} />
    </div>
  )
}
