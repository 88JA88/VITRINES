#import <Cocoa/Cocoa.h>
#include <signal.h>
#include <fcntl.h>
#include <sys/file.h>

@interface ControleServeur : NSObject <NSApplicationDelegate>
@property (strong) NSWindow *panneau;
@property pid_t serveurPid;
@end

@implementation ControleServeur

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSArray<NSString *> *arguments = NSProcessInfo.processInfo.arguments;
    if (arguments.count > 1) {
        self.serveurPid = (pid_t)arguments[1].intValue;
    }
    NSRect ecran = NSScreen.mainScreen.visibleFrame;
    NSSize taille = NSMakeSize(278, 48);
    NSPoint origine = NSMakePoint(NSMinX(ecran) + 12, NSMaxY(ecran) - taille.height - 12);

    self.panneau = [[NSWindow alloc] initWithContentRect:NSMakeRect(origine.x, origine.y, taille.width, taille.height)
                                                styleMask:NSWindowStyleMaskBorderless
                                                  backing:NSBackingStoreBuffered
                                                    defer:NO];
    self.panneau.level = NSFloatingWindowLevel;
    self.panneau.backgroundColor = NSColor.windowBackgroundColor;
    self.panneau.hasShadow = YES;
    self.panneau.movableByWindowBackground = YES;

    NSTextField *etat = [NSTextField labelWithString:@"Serveur actif"];
    etat.frame = NSMakeRect(10, 13, 96, 22);
    etat.font = [NSFont systemFontOfSize:13 weight:NSFontWeightSemibold];
    [self.panneau.contentView addSubview:etat];

    NSButton *bouton = [[NSButton alloc] initWithFrame:NSMakeRect(112, 8, 156, 32)];
    bouton.attributedTitle = [[NSAttributedString alloc] initWithString:@"Arrêter le serveur"
                                                               attributes:@{
        NSForegroundColorAttributeName: NSColor.whiteColor,
        NSFontAttributeName: [NSFont systemFontOfSize:13 weight:NSFontWeightSemibold]
    }];
    bouton.target = self;
    bouton.action = @selector(arreter:);
    bouton.bordered = NO;
    bouton.wantsLayer = YES;
    bouton.layer.backgroundColor = NSColor.systemRedColor.CGColor;
    bouton.layer.cornerRadius = 7;
    [self.panneau.contentView addSubview:bouton];

    [self.panneau makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (void)arreter:(id)sender {
    if (self.serveurPid > 0) {
        kill(self.serveurPid, SIGTERM);
    }
    [NSApp terminate:nil];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        int verrou = open("/tmp/vitrines-controle.lock", O_CREAT | O_RDWR, 0600);
        if (verrou < 0 || flock(verrou, LOCK_EX | LOCK_NB) != 0) {
            return 0;
        }
        NSApplication *application = NSApplication.sharedApplication;
        ControleServeur *controle = [ControleServeur new];
        application.delegate = controle;
        [application setActivationPolicy:NSApplicationActivationPolicyAccessory];
        [application run];
    }
    return 0;
}
