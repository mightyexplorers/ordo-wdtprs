#!/usr/bin/perl
use utf8;

# JSON calendar export for the WDTPRS Ordo, run inside the Divinum Officium container
# (mounted next to kalendar.pl as cgi-bin/horas/ordojson.pl; see scripts/calendar1962.mjs).
#   GET /cgi-bin/horas/ordojson.pl?kyear=2026&version=Rubrics%201960%20-%202020%20USA
# One object per day: the winning office (file id, Latin and English names, rank),
# the season code, and commemorations. Setup mirrors kalendar.pl.
package main;

use POSIX;
use FindBin qw($Bin);
use CGI;
use CGI::Cookie;
use File::Basename;
use Time::Local;
use JSON::PP;

use locale;
use lib "$Bin/..";
use DivinumOfficium::Main qw(liturgical_color);
use DivinumOfficium::Directorium qw(get_from_directorium dirge);
use DivinumOfficium::Date qw(ydays_to_date);
use DivinumOfficium::RunTimeOptions qw(check_version);

our ($error, $debug, @dayname, $winner, $commemoratio, $scriptura, $commune, $communetype, $rank, $vespera);
our (%winner, %commemoratio, %scriptura, %commune, $rule, $communerule, $duplex, $initia, $dayofweek);
our ($border, $smallblack, $smallfont);

require "$Bin/../DivinumOfficium/SetupString.pl";
require "$Bin/horascommon.pl";
require "$Bin/specmatins.pl";
require "$Bin/../DivinumOfficium/dialogcommon.pl";
require "$Bin/webdia.pl";
require "$Bin/../DivinumOfficium/setup.pl";
require "$Bin/monastic.pl";
require "$Bin/kalendar/ordo.pl";

our $q = new CGI;
getini('horas');
loadsetup('');
set_runtime_options('general');
our $votive = 'Hodie';
set_runtime_options('parameters');

our $version1 = check_version(strictparam('version')) || 'Rubrics 1960 - 1960';
our $dioecesis = strictparam('dioecesis') || 'Generale';
my $kyear = strictparam('kyear') || (localtime)[5] + 1900;
our $lang1 = 'Latin';

# Name of an office file ("Sancti/09-21") in a language: the first field of its [Rank].
sub office_name {
  my ($lang, $file) = @_;
  my %h = %{setupstring($lang, "$file.txt") || {}};
  (my $name = $h{Rank} // '') =~ s/;;.*//s;
  $name;
}

my @days;
my $count = 365 + leapyear($kyear);
for my $cday (1 .. $count) {
  my ($d, $m, $y) = ydays_to_date($cday, $kyear);
  my $date = sprintf('%02i-%02i-%04i', $m, $d, $y);

  local $lang1 = 'Latin';
  my $latin = ordo_entry($date, $version1, $dioecesis, 0, 'winneronly');    # sets $winner, @commemoentries
  my ($latName, $latRank) = split(/, /, $latin, 2);
  my $file = $winner =~ s/\.txt$//r;

  $lang1 = 'English';
  %winner = %{officestring('English', $winner, 0)};
  my ($engName, $engRank) = split(/\s*~\s*/, setheadline());

  our @commemoentries;
  my @comm;
  for my $c (@commemoentries) {
    my $cf = $c =~ s/\.txt$//r;
    next if $cf eq $file;
    push @comm, { file => $cf, latin => office_name('Latin', $cf), english => office_name('English', $cf) };
  }

  push @days, {
    date => sprintf('%04i-%02i-%02i', $y, $m, $d),
    file => $file,
    season => $dayname[0],
    latin => $latName,
    english => $engName,
    rank => $latRank,
    color => liturgical_color($latName),
    commemorations => \@comm,
  };
}

binmode(STDOUT);
print "Content-Type: application/json; charset=utf-8\n\n";
print JSON::PP->new->utf8->canonical->encode({ version => $version1, year => $kyear + 0, days => \@days });
